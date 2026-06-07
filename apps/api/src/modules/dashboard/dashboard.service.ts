import { Injectable } from "@nestjs/common";
import {
  AppointmentStatus,
  InventoryMovementType,
  PaymentStatus,
  Prisma,
  TreatmentStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

type MonthBucket = {
  appointments: number;
  expenses: number;
  key: string;
  label: string;
  newPatients: number;
  newTreatments: number;
  revenue: number;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = addDays(todayStart, 1);
    const currentMonthStart = startOfMonth(now);
    const nextMonthStart = addMonths(currentMonthStart, 1);
    const previousMonthStart = addMonths(currentMonthStart, -1);
    const chartStart = addMonths(currentMonthStart, -5);
    const calendarEnd = nextMonthStart;

    const [
      appointmentsForChart,
      appointmentsToday,
      calendarAppointments,
      clinic,
      inventoryAlerts,
      inventoryPurchases,
      patientCount,
      patientsForChart,
      paymentsForChart,
      pendingPayments,
      treatmentsForChart,
      treatmentSummary,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        select: { startsAt: true },
        where: {
          deletedAt: null,
          startsAt: { gte: chartStart, lt: nextMonthStart },
          status: { not: AppointmentStatus.CANCELLED },
        },
      }),
      this.prisma.appointment.findMany({
        orderBy: { startsAt: "asc" },
        select: {
          doctor: { select: { fullName: true, id: true } },
          endsAt: true,
          id: true,
          patient: {
            select: {
              code: true,
              firstName: true,
              id: true,
              lastName: true,
            },
          },
          startsAt: true,
          status: true,
          title: true,
        },
        take: 8,
        where: {
          deletedAt: null,
          startsAt: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      this.prisma.appointment.findMany({
        select: { startsAt: true, status: true },
        where: {
          deletedAt: null,
          startsAt: { gte: currentMonthStart, lt: calendarEnd },
        },
      }),
      this.prisma.clinicSettings.findUnique({
        select: { currency: true },
        where: { id: "primary" },
      }),
      this.prisma.inventoryItem.findMany({
        orderBy: [{ currentStock: "asc" }, { name: "asc" }],
        select: {
          currentStock: true,
          id: true,
          minimumStock: true,
          name: true,
          unit: true,
        },
        where: { deletedAt: null },
      }),
      this.prisma.inventoryMovement.findMany({
        select: {
          createdAt: true,
          quantity: true,
          unitCost: true,
        },
        where: {
          createdAt: { gte: chartStart, lt: nextMonthStart },
          type: InventoryMovementType.PURCHASE,
        },
      }),
      this.prisma.patient.count({ where: { deletedAt: null } }),
      this.prisma.patient.findMany({
        select: { createdAt: true },
        where: {
          createdAt: { gte: chartStart, lt: nextMonthStart },
          deletedAt: null,
        },
      }),
      this.prisma.payment.findMany({
        select: { amount: true, paidAt: true, status: true },
        where: {
          deletedAt: null,
          paidAt: { gte: chartStart, lt: nextMonthStart },
        },
      }),
      this.prisma.payment.findMany({
        select: {
          amount: true,
          patient: {
            select: {
              firstName: true,
              id: true,
              lastName: true,
            },
          },
        },
        where: {
          deletedAt: null,
          status: PaymentStatus.PENDING,
        },
      }),
      this.prisma.treatment.findMany({
        select: { createdAt: true },
        where: {
          createdAt: { gte: chartStart, lt: nextMonthStart },
          deletedAt: null,
          status: { not: TreatmentStatus.CANCELLED },
        },
      }),
      this.prisma.treatment.findMany({
        select: { name: true, status: true },
        where: { deletedAt: null },
      }),
    ]);

    const monthBuckets = createMonthBuckets(currentMonthStart);
    const currentMonthKey = monthKey(currentMonthStart);
    const previousMonthKey = monthKey(previousMonthStart);

    for (const patient of patientsForChart) {
      const bucket = monthBuckets.get(monthKey(patient.createdAt));
      if (bucket) bucket.newPatients += 1;
    }

    for (const appointment of appointmentsForChart) {
      const bucket = monthBuckets.get(monthKey(appointment.startsAt));
      if (bucket) bucket.appointments += 1;
    }

    for (const treatment of treatmentsForChart) {
      const bucket = monthBuckets.get(monthKey(treatment.createdAt));
      if (bucket) bucket.newTreatments += 1;
    }

    for (const payment of paymentsForChart) {
      if (
        payment.status !== PaymentStatus.PAID &&
        payment.status !== PaymentStatus.PARTIAL
      ) {
        continue;
      }

      const bucket = monthBuckets.get(monthKey(payment.paidAt));
      if (bucket) bucket.revenue += toNumber(payment.amount);
    }

    for (const purchase of inventoryPurchases) {
      const bucket = monthBuckets.get(monthKey(purchase.createdAt));
      if (bucket) {
        bucket.expenses +=
          toNumber(purchase.quantity) * toNumber(purchase.unitCost);
      }
    }

    const monthlyTrend = [...monthBuckets.values()];
    const currentMonth = monthBuckets.get(currentMonthKey)!;
    const previousMonth = monthBuckets.get(previousMonthKey);
    const activeTreatments = treatmentSummary.filter(
      (treatment) =>
        treatment.status === TreatmentStatus.PLANNED ||
        treatment.status === TreatmentStatus.IN_PROGRESS,
    ).length;
    const inProgressTreatments = treatmentSummary.filter(
      (treatment) => treatment.status === TreatmentStatus.IN_PROGRESS,
    ).length;
    const pendingAppointments = appointmentsToday.filter(
      (appointment) => appointment.status === AppointmentStatus.PENDING,
    ).length;
    const lowStockItems = inventoryAlerts.filter(
      (item) =>
        item.currentStock.lte(item.minimumStock) && item.minimumStock.gt(0),
    );
    const outOfStock = lowStockItems.filter((item) =>
      item.currentStock.isZero(),
    ).length;
    const pendingPatientIds = new Set(
      pendingPayments.map((payment) => payment.patient.id),
    );
    const pendingPaymentAmount = pendingPayments.reduce(
      (total, payment) => total + toNumber(payment.amount),
      0,
    );
    const treatmentCounts = new Map<string, { name: string; total: number }>();

    for (const treatment of treatmentSummary) {
      if (treatment.status === TreatmentStatus.CANCELLED) continue;

      const key = treatment.name.trim().toLocaleLowerCase();
      const entry = treatmentCounts.get(key) ?? {
        name: treatment.name.trim(),
        total: 0,
      };
      entry.total += 1;
      treatmentCounts.set(key, entry);
    }

    const topTreatments = [...treatmentCounts.values()]
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, 5);
    const topTreatmentTotal = topTreatments.reduce(
      (total, treatment) => total + treatment.total,
      0,
    );
    const calendarDays = new Map<string, { cancelled: number; total: number }>();

    for (const appointment of calendarAppointments) {
      const key = dateKey(appointment.startsAt);
      const entry = calendarDays.get(key) ?? { cancelled: 0, total: 0 };
      entry.total += 1;
      if (appointment.status === AppointmentStatus.CANCELLED) {
        entry.cancelled += 1;
      }
      calendarDays.set(key, entry);
    }

    return {
      alerts: {
        activeTreatments,
        lowStock: lowStockItems.length,
        outOfStock,
        pendingAppointments,
        pendingPaymentAmount,
        pendingPaymentPatients: pendingPatientIds.size,
      },
      calendar: {
        days: [...calendarDays.entries()].map(([date, counts]) => ({
          date,
          ...counts,
        })),
        month: currentMonthKey,
      },
      currency: clinic?.currency ?? "USD",
      metrics: {
        activeTreatments,
        appointmentsToday: appointmentsToday.length,
        currentMonthRevenue: currentMonth.revenue,
        inProgressTreatments,
        newPatientsThisMonth: currentMonth.newPatients,
        patientCount,
        pendingAppointments,
        revenueChangePercent: percentageChange(
          currentMonth.revenue,
          previousMonth?.revenue ?? 0,
        ),
      },
      monthlyTrend,
      todayAppointments: appointmentsToday,
      topTreatments: topTreatments.map((treatment) => ({
        ...treatment,
        percentage:
          topTreatmentTotal > 0
            ? Math.round((treatment.total / topTreatmentTotal) * 100)
            : 0,
      })),
    };
  }
}

function createMonthBuckets(referenceMonth: Date) {
  const buckets = new Map<string, MonthBucket>();

  for (let offset = -5; offset <= 0; offset += 1) {
    const date = addMonths(referenceMonth, offset);
    const key = monthKey(date);
    buckets.set(key, {
      appointments: 0,
      expenses: 0,
      key,
      label: new Intl.DateTimeFormat("es-EC", { month: "short" }).format(date),
      newPatients: 0,
      newTreatments: 0,
      revenue: 0,
    });
  }

  return buckets;
}

function percentageChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function toNumber(value: Prisma.Decimal | number | string | null) {
  if (value === null) return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
