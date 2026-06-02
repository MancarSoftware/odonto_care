import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, AuditAction, Prisma } from "@prisma/client";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
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

  findRange(query: AppointmentRangeQuery) {
    const from = query.from ? new Date(query.from) : startOfToday();
    const to = query.to ? new Date(query.to) : addDays(from, 7);

    return this.prisma.appointment.findMany({
      orderBy: { startsAt: "asc" },
      select: appointmentSelect,
      where: {
        deletedAt: null,
        startsAt: { gte: from },
        endsAt: { lte: to },
      },
    });
  }

  async create(dto: CreateAppointmentDto, actorId: string) {
    this.ensureValidRange(dto.startsAt, dto.endsAt);
    await this.ensurePatientExists(dto.patientId);

    const appointment = await this.prisma.appointment.create({
      data: withoutUndefined({
        color: dto.color?.trim(),
        createdById: actorId,
        doctorId: dto.doctorId,
        endsAt: new Date(dto.endsAt),
        notes: dto.notes?.trim(),
        patientId: dto.patientId,
        startsAt: new Date(dto.startsAt),
        status: dto.status ?? AppointmentStatus.PENDING,
        title: dto.title.trim(),
      }),
      select: appointmentSelect,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      actorId,
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

    this.ensureValidRange(startsAt, endsAt);

    if (dto.patientId) {
      await this.ensurePatientExists(dto.patientId);
    }

    const appointment = await this.prisma.appointment.update({
      data: withoutUndefined({
        color: dto.color?.trim(),
        doctorId: dto.doctorId,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        notes: dto.notes?.trim(),
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

  private async ensureAppointmentExists(id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      select: { endsAt: true, id: true, startsAt: true, status: true },
      where: { id, deletedAt: null },
    });

    if (!appointment) {
      throw new NotFoundException("Cita no encontrada");
    }

    return appointment;
  }
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
