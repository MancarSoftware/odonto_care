import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, TreatmentStatus } from "@prisma/client";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateTreatmentDto } from "./dto/create-treatment.dto";
import { UpdateTreatmentDto } from "./dto/update-treatment.dto";

const treatmentInclude = {
  patient: {
    select: { id: true, code: true, firstName: true, lastName: true },
  },
  doctor: {
    select: { id: true, fullName: true },
  },
  payments: {
    select: { amount: true, status: true },
    where: { deletedAt: null },
  },
} satisfies Prisma.TreatmentInclude;

@Injectable()
export class TreatmentsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  findAll(patientId?: string) {
    return this.prisma.treatment.findMany({
      include: treatmentInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
      where: withoutUndefined({ deletedAt: null, patientId }),
    });
  }

  async create(dto: CreateTreatmentDto, actorId: string) {
    await this.ensurePatientExists(dto.patientId);

    const treatment = await this.prisma.treatment.create({
      data: withoutUndefined({
        description: dto.description?.trim(),
        doctorId: actorId,
        estimatedCost: dto.estimatedCost,
        name: dto.name.trim(),
        patientId: dto.patientId,
        startedAt:
          dto.status === TreatmentStatus.IN_PROGRESS ? new Date() : undefined,
        status: dto.status ?? TreatmentStatus.PLANNED,
        toothNumber: dto.toothNumber,
      }),
      include: treatmentInclude,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      actorId,
      after: { name: treatment.name, status: treatment.status },
      entity: "Treatment",
      entityId: treatment.id,
    });

    return treatment;
  }

  async update(id: string, dto: UpdateTreatmentDto, actorId: string) {
    const existing = await this.ensureTreatmentExists(id);

    const treatment = await this.prisma.treatment.update({
      data: withoutUndefined({
        completedAt:
          dto.status === TreatmentStatus.COMPLETED ? new Date() : undefined,
        description: dto.description?.trim(),
        estimatedCost: dto.estimatedCost,
        name: dto.name?.trim(),
        startedAt:
          dto.status === TreatmentStatus.IN_PROGRESS && !existing.startedAt
            ? new Date()
            : undefined,
        status: dto.status,
        toothNumber: dto.toothNumber,
      }),
      include: treatmentInclude,
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      actorId,
      after: { name: treatment.name, status: treatment.status },
      before: { name: existing.name, status: existing.status },
      entity: "Treatment",
      entityId: id,
    });

    return treatment;
  }

  async softDelete(id: string, actorId: string) {
    const existing = await this.ensureTreatmentExists(id);

    await this.prisma.treatment.update({
      data: { deletedAt: new Date() },
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      actorId,
      before: { name: existing.name, status: existing.status },
      entity: "Treatment",
      entityId: id,
    });

    return { id };
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

  private async ensureTreatmentExists(id: string) {
    const treatment = await this.prisma.treatment.findFirst({
      select: {
        id: true,
        name: true,
        startedAt: true,
        status: true,
      },
      where: { id, deletedAt: null },
    });

    if (!treatment) {
      throw new NotFoundException("Tratamiento no encontrado");
    }

    return treatment;
  }
}
