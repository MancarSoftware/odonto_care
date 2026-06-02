import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  TreatmentStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { ReportSummaryQueryDto } from "./dto/report-summary-query.dto";

type ReportRange = {
  from: Date;
  to: Date;
};

type RevenueBucket = {
  date: string;
  total: number;
  payments: number;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: ReportSummaryQueryDto) {
    const range = parseRange(query);

    const [
      appointments,
      mediaAssets,
      newPatients,
      payments,
      treatments,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        select: {
          patientId: true,
          startsAt: true,
          status: true,
        },
        where: {
          deletedAt: null,
          startsAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.mediaAsset.count({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          deletedAt: null,
        },
      }),
      this.prisma.patient.count({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          deletedAt: null,
        },
      }),
      this.prisma.payment.findMany({
        orderBy: { paidAt: "desc" },
        select: {
          amount: true,
          method: true,
          paidAt: true,
          patient: {
            select: {
              code: true,
              firstName: true,
              id: true,
              lastName: true,
            },
          },
          reference: true,
          status: true,
          treatment: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        where: {
          deletedAt: null,
          paidAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.treatment.findMany({
        select: {
          completedAt: true,
          createdAt: true,
          estimatedCost: true,
          name: true,
          status: true,
        },
        where: {
          createdAt: { gte: range.from, lte: range.to },
          deletedAt: null,
        },
      }),
    ]);

    const appointmentStatus = createAppointmentStatusCounts();
    const treatmentStatus = createTreatmentStatusCounts();
    const paymentMethods = createPaymentMethodTotals();
    const revenueByDay = buildRevenueBuckets(range);
    const completedPatientIds = new Set<string>();
    const topTreatments = new Map<
      string,
      { estimatedTotal: number; name: string; total: number }
    >();

    let collectedRevenue = 0;
    let pendingRevenue = 0;
    let voidPayments = 0;

    for (const appointment of appointments) {
      appointmentStatus[appointment.status] += 1;

      if (appointment.status === AppointmentStatus.COMPLETED) {
        completedPatientIds.add(appointment.patientId);
      }
    }

    for (const treatment of treatments) {
      treatmentStatus[treatment.status] += 1;

      const key = treatment.name.trim().toLowerCase();
      const existing = topTreatments.get(key) ?? {
        estimatedTotal: 0,
        name: treatment.name,
        total: 0,
      };

      existing.total += 1;
      existing.estimatedTotal += toNumber(treatment.estimatedCost);
      topTreatments.set(key, existing);
    }

    for (const payment of payments) {
      const amount = toNumber(payment.amount);

      if (payment.status === PaymentStatus.VOID) {
        voidPayments += 1;
        continue;
      }

      if (payment.status === PaymentStatus.PENDING) {
        pendingRevenue += amount;
        continue;
      }

      collectedRevenue += amount;
      paymentMethods[payment.method] += amount;

      const bucket = revenueByDay.get(toDateKey(payment.paidAt));
      if (bucket) {
        bucket.total += amount;
        bucket.payments += 1;
      }
    }

    const completedAppointments = appointmentStatus.COMPLETED;
    const cancelledAppointments = appointmentStatus.CANCELLED;
    const totalAppointments = appointments.length;
    const attendanceRate =
      totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;

    return {
      appointmentStatus,
      metrics: {
        attendanceRate,
        cancelledAppointments,
        collectedRevenue,
        completedAppointments,
        completedTreatments: treatmentStatus.COMPLETED,
        mediaAssets,
        newPatients,
        pendingRevenue,
        patientsSeen: completedPatientIds.size,
        totalAppointments,
        totalPayments: payments.length,
        totalTreatments: treatments.length,
        voidPayments,
      },
      paymentMethods,
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      recentPayments: payments.slice(0, 8).map((payment) => ({
        amount: toNumber(payment.amount),
        method: payment.method,
        paidAt: payment.paidAt.toISOString(),
        patient: payment.patient,
        reference: payment.reference,
        status: payment.status,
        treatment: payment.treatment,
      })),
      revenueByDay: [...revenueByDay.values()],
      topTreatments: [...topTreatments.values()]
        .sort((a, b) => b.total - a.total || b.estimatedTotal - a.estimatedTotal)
        .slice(0, 6),
      treatmentStatus,
    };
  }
}

function parseRange(query: ReportSummaryQueryDto): ReportRange {
  const today = new Date();
  const from = query.from ? startOfDay(new Date(query.from)) : addDays(startOfDay(today), -29);
  const to = query.to ? endOfDay(new Date(query.to)) : endOfDay(today);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    throw new BadRequestException("Rango de fechas invalido");
  }

  return { from, to };
}

function createAppointmentStatusCounts(): Record<AppointmentStatus, number> {
  return {
    CANCELLED: 0,
    COMPLETED: 0,
    CONFIRMED: 0,
    PENDING: 0,
  };
}

function createTreatmentStatusCounts(): Record<TreatmentStatus, number> {
  return {
    CANCELLED: 0,
    COMPLETED: 0,
    IN_PROGRESS: 0,
    PLANNED: 0,
  };
}

function createPaymentMethodTotals(): Record<PaymentMethod, number> {
  return {
    CARD: 0,
    CASH: 0,
    INSURANCE: 0,
    OTHER: 0,
    TRANSFER: 0,
  };
}

function buildRevenueBuckets(range: ReportRange): Map<string, RevenueBucket> {
  const buckets = new Map<string, RevenueBucket>();
  let cursor = startOfDay(range.from);
  const end = startOfDay(range.to);

  while (cursor <= end) {
    const date = toDateKey(cursor);
    buckets.set(date, { date, payments: 0, total: 0 });
    cursor = addDays(cursor, 1);
  }

  return buckets;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toNumber(value: Prisma.Decimal | number | string | null): number {
  if (value === null) {
    return 0;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
