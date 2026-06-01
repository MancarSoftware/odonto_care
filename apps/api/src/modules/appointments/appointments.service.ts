import { Injectable } from "@nestjs/common";
import { AppointmentStatus, Prisma } from "@prisma/client";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";

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
  constructor(private readonly prisma: PrismaService) {}

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

  create(dto: CreateAppointmentDto, actorId: string) {
    return this.prisma.appointment.create({
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
