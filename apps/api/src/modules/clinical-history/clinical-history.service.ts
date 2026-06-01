import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateClinicalEntryDto } from "./dto/create-clinical-entry.dto";
import { UpdateClinicalEntryDto } from "./dto/update-clinical-entry.dto";

const clinicalEntrySelect = {
  id: true,
  title: true,
  type: true,
  notes: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      fullName: true,
      role: true,
    },
  },
} satisfies Prisma.ClinicalEntrySelect;

@Injectable()
export class ClinicalHistoryService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  findByPatient(patientId: string) {
    return this.prisma.clinicalEntry.findMany({
      orderBy: { createdAt: "desc" },
      select: clinicalEntrySelect,
      where: { patientId, deletedAt: null },
    });
  }

  async create(
    patientId: string,
    dto: CreateClinicalEntryDto,
    actorId: string,
  ) {
    await this.ensurePatientExists(patientId);

    const entry = await this.prisma.clinicalEntry.create({
      data: withoutUndefined({
        authorId: actorId,
        metadata: parseMetadata(dto.metadata),
        notes: dto.notes.trim(),
        patientId,
        title: dto.title.trim(),
        type: dto.type,
      }),
      select: clinicalEntrySelect,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      actorId,
      after: { title: entry.title, type: entry.type },
      entity: "ClinicalEntry",
      entityId: entry.id,
    });

    return entry;
  }

  async update(
    patientId: string,
    entryId: string,
    dto: UpdateClinicalEntryDto,
    actorId: string,
  ) {
    const existing = await this.ensureEntryExists(patientId, entryId);

    const entry = await this.prisma.clinicalEntry.update({
      data: withoutUndefined({
        notes: dto.notes?.trim(),
        title: dto.title?.trim(),
        type: dto.type,
      }),
      select: clinicalEntrySelect,
      where: { id: entryId },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      actorId,
      after: { title: entry.title, type: entry.type },
      before: { title: existing.title, type: existing.type },
      entity: "ClinicalEntry",
      entityId: entry.id,
    });

    return entry;
  }

  async softDelete(patientId: string, entryId: string, actorId: string) {
    const existing = await this.ensureEntryExists(patientId, entryId);

    await this.prisma.clinicalEntry.update({
      data: { deletedAt: new Date() },
      where: { id: entryId },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      actorId,
      before: { title: existing.title, type: existing.type },
      entity: "ClinicalEntry",
      entityId: entryId,
    });

    return { id: entryId };
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

  private async ensureEntryExists(patientId: string, entryId: string) {
    const entry = await this.prisma.clinicalEntry.findFirst({
      select: { id: true, title: true, type: true },
      where: { id: entryId, patientId, deletedAt: null },
    });

    if (!entry) {
      throw new NotFoundException("Entrada clinica no encontrada");
    }

    return entry;
  }
}

function parseMetadata(value?: string): Prisma.InputJsonValue | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  return { text: value.trim() };
}
