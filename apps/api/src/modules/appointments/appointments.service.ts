import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  AuditAction,
  Prisma,
  UserRole,
} from "@prisma/client";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../auth/types";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";

const appointmentSelect = {
  id: true,
  title: true,
  status: true,
  startsAt: true,
  endsAt: true,
  color: true,
  notes: true,
  patient: {
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      payments: {
        select: {
          amount: true,
          status: true,
        },
        where: { deletedAt: null },
      },
      treatments: {
        select: {
          estimatedCost: true,
          status: true,
        },
        where: { deletedAt: null },
      },
    },
  },
  doctor: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.AppointmentSelect;

type AppointmentRangeQuery = {
  from?: string | undefined;
  to?: string | undefined;
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async findRange(query: AppointmentRangeQuery) {
    const from = query.from ? new Date(query.from) : startOfToday();
    const to = query.to ? new Date(query.to) : addDays(from, 7);

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to <= from ||
      to.getTime() - from.getTime() > 62 * 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestException("Rango de agenda invalido");
    }

    const appointments = await this.prisma.appointment.findMany({
      orderBy: { startsAt: "asc" },
      select: appointmentSelect,
      where: {
        deletedAt: null,
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
    });

    return appointments.map((appointment) => {
      const estimatedAmount = appointment.patient.treatments.reduce(
        (total, treatment) => total + toNumber(treatment.estimatedCost),
        0,
      );
      const collectedAmount = appointment.patient.payments
        .filter((payment) => payment.status === "PAID" || payment.status === "PARTIAL")
        .reduce((total, payment) => total + toNumber(payment.amount), 0);
      const pendingPayments = appointment.patient.payments.filter(
        (payment) => payment.status === "PENDING",
      );
      const pendingPaymentAmount = pendingPayments.reduce(
        (total, payment) => total + toNumber(payment.amount),
        0,
      );
      const pendingAmount = Math.max(
        estimatedAmount - collectedAmount,
        pendingPaymentAmount,
        0,
      );
      const { payments: _payments, treatments: _treatments, ...patient } =
        appointment.patient;

      return {
        ...appointment,
        billingSummary: {
          hasPendingBalance: pendingAmount > 0,
          pendingAmount,
          pendingPayments: pendingPayments.length,
        },
        patient,
      };
    });
  }

  findDoctors() {
    return this.prisma.user.findMany({
      orderBy: { fullName: "asc" },
      select: { fullName: true, id: true, role: true },
      where: {
        deletedAt: null,
        isActive: true,
        role: { in: [UserRole.ADMIN, UserRole.DENTIST] },
      },
    });
  }

  async create(dto: CreateAppointmentDto, actor: AuthenticatedUser) {
    this.ensureValidRange(dto.startsAt, dto.endsAt);
    await this.ensurePatientExists(dto.patientId);
    const status = dto.status ?? AppointmentStatus.PENDING;
    const doctorId =
      dto.doctorId ?? (actor.role === UserRole.DENTIST ? actor.id : undefined);

    if (doctorId) {
      await this.ensureDoctorExists(doctorId);
      if (status !== AppointmentStatus.CANCELLED) {
        await this.ensureDoctorAvailability(
          doctorId,
          new Date(dto.startsAt),
          new Date(dto.endsAt),
        );
      }
    }

    const appointment = await this.prisma.appointment.create({
      data: withoutUndefined({
        color: dto.color?.trim(),
        createdById: actor.id,
        doctorId,
        endsAt: new Date(dto.endsAt),
        notes: dto.notes?.trim(),
        patientId: dto.patientId,
        startsAt: new Date(dto.startsAt),
        status,
        title: dto.title.trim(),
      }),
      select: appointmentSelect,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      actorId: actor.id,
      after: {
        patientId: dto.patientId,
        startsAt: appointment.startsAt,
        status: appointment.status,
        title: appointment.title,
      },
      entity: "Appointment",
      entityId: appointment.id,
    });

    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto, actorId: string) {
    const existing = await this.ensureAppointmentExists(id);
    const startsAt = dto.startsAt ?? existing.startsAt.toISOString();
    const endsAt = dto.endsAt ?? existing.endsAt.toISOString();
    const doctorId =
      dto.doctorId === undefined ? existing.doctorId : dto.doctorId;
    const status = dto.status ?? existing.status;

    this.ensureValidRange(startsAt, endsAt);

    if (dto.patientId) {
      await this.ensurePatientExists(dto.patientId);
    }

    if (doctorId) {
      await this.ensureDoctorExists(doctorId);
      if (status !== AppointmentStatus.CANCELLED) {
        await this.ensureDoctorAvailability(
          doctorId,
          new Date(startsAt),
          new Date(endsAt),
          id,
        );
      }
    }

    const appointment = await this.prisma.appointment.update({
      data: withoutUndefined({
        color: normalizeOptional(dto.color),
        doctorId: dto.doctorId,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        notes: normalizeOptional(dto.notes),
        patientId: dto.patientId,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        status: dto.status,
        title: dto.title?.trim(),
      }),
      select: appointmentSelect,
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      actorId,
      after: { startsAt: appointment.startsAt, status: appointment.status },
      before: { startsAt: existing.startsAt, status: existing.status },
      entity: "Appointment",
      entityId: id,
    });

    return appointment;
  }

  async softDelete(id: string, actorId: string) {
    const existing = await this.ensureAppointmentExists(id);

    await this.prisma.appointment.update({
      data: { deletedAt: new Date() },
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      actorId,
      before: { startsAt: existing.startsAt, status: existing.status },
      entity: "Appointment",
      entityId: id,
    });

    return { id };
  }

  private ensureValidRange(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      throw new BadRequestException("La cita debe tener un horario valido");
    }
  }

  private async ensurePatientExists(patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      select: { id: true },
      where: { id: patientId, deletedAt: null },
    });

    if (!patient) {
      throw new NotFoundException("Paciente no encontrado");
    }
  }

  private async ensureDoctorExists(doctorId: string) {
    const doctor = await this.prisma.user.findFirst({
      select: { id: true },
      where: {
        deletedAt: null,
        id: doctorId,
        isActive: true,
        role: { in: [UserRole.ADMIN, UserRole.DENTIST] },
      },
    });

    if (!doctor) {
      throw new NotFoundException("Odontologo no encontrado");
    }
  }

  private async ensureDoctorAvailability(
    doctorId: string,
    startsAt: Date,
    endsAt: Date,
    excludeAppointmentId?: string,
  ) {
    const conflict = await this.prisma.appointment.findFirst({
      select: { id: true, startsAt: true },
      where: {
        deletedAt: null,
        doctorId,
        endsAt: { gt: startsAt },
        ...(excludeAppointmentId
          ? { id: { not: excludeAppointmentId } }
          : {}),
        startsAt: { lt: endsAt },
        status: { not: AppointmentStatus.CANCELLED },
      },
    });

    if (conflict) {
      throw new BadRequestException(
        `El odontologo ya tiene una cita a las ${formatTime(conflict.startsAt)}`,
      );
    }
  }

  private async ensureAppointmentExists(id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      select: {
        doctorId: true,
        endsAt: true,
        id: true,
        startsAt: true,
        status: true,
      },
      where: { id, deletedAt: null },
    });

    if (!appointment) {
      throw new NotFoundException("Cita no encontrada");
    }

    return appointment;
  }
}

function normalizeOptional(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.trim() || null;
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("es-EC", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(value);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toNumber(value: Prisma.Decimal | number | string | null): number {
  if (value === null) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
