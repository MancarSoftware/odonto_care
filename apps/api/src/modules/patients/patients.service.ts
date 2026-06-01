import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Gender, Prisma } from "@prisma/client";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";

const patientSelect = {
  id: true,
  code: true,
  firstName: true,
  lastName: true,
  documentId: true,
  birthDate: true,
  gender: true,
  phone: true,
  email: true,
  address: true,
  allergies: true,
  medicalAlerts: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PatientSelect;

type FindPatientsQuery = {
  q?: string | undefined;
};

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: FindPatientsQuery) {
    const search = query.q?.trim();
    const where: Prisma.PatientWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { documentId: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return this.prisma.patient.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: patientSelect,
      take: 50,
      where,
    });
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findFirst({
      select: {
        ...patientSelect,
        occupation: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        notes: true,
        clinicalEntries: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            type: true,
            notes: true,
            createdAt: true,
          },
          take: 20,
          where: { deletedAt: null },
        },
      },
      where: { id, deletedAt: null },
    });

    if (!patient) {
      throw new NotFoundException("Paciente no encontrado");
    }

    return patient;
  }

  async create(dto: CreatePatientDto, actorId: string) {
    const patient = await this.prisma.patient.create({
      data: {
        ...this.mapCreatePatientInput(dto),
        code: await this.generatePatientCode(),
        createdById: actorId,
      },
      select: patientSelect,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      actorId,
      after: { code: patient.code, name: `${patient.firstName} ${patient.lastName}` },
      entity: "Patient",
      entityId: patient.id,
    });

    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, actorId: string) {
    const existing = await this.prisma.patient.findFirst({
      select: { id: true, code: true, firstName: true, lastName: true },
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException("Paciente no encontrado");
    }

    const patient = await this.prisma.patient.update({
      data: this.mapUpdatePatientInput(dto),
      select: patientSelect,
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      actorId,
      after: { code: patient.code, name: `${patient.firstName} ${patient.lastName}` },
      before: {
        code: existing.code,
        name: `${existing.firstName} ${existing.lastName}`,
      },
      entity: "Patient",
      entityId: patient.id,
    });

    return patient;
  }

  async softDelete(id: string, actorId: string) {
    const patient = await this.prisma.patient.findFirst({
      select: { id: true, code: true },
      where: { id, deletedAt: null },
    });

    if (!patient) {
      throw new NotFoundException("Paciente no encontrado");
    }

    await this.prisma.patient.update({
      data: { deletedAt: new Date() },
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      actorId,
      before: { code: patient.code },
      entity: "Patient",
      entityId: id,
    });

    return { id };
  }

  private mapCreatePatientInput(
    dto: CreatePatientDto,
  ): Prisma.PatientUncheckedCreateInput {
    return withoutUndefined({
      address: dto.address?.trim(),
      allergies: dto.allergies?.trim(),
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      documentId: dto.documentId?.trim(),
      email: dto.email?.toLowerCase().trim(),
      emergencyContactName: dto.emergencyContactName?.trim(),
      emergencyContactPhone: dto.emergencyContactPhone?.trim(),
      firstName: dto.firstName.trim(),
      gender: dto.gender ?? Gender.UNSPECIFIED,
      lastName: dto.lastName.trim(),
      medicalAlerts: dto.medicalAlerts?.trim(),
      notes: dto.notes?.trim(),
      occupation: dto.occupation?.trim(),
      phone: dto.phone?.trim(),
    }) as Prisma.PatientUncheckedCreateInput;
  }

  private mapUpdatePatientInput(
    dto: UpdatePatientDto,
  ): Prisma.PatientUncheckedUpdateInput {
    return withoutUndefined({
      address: dto.address?.trim(),
      allergies: dto.allergies?.trim(),
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      documentId: dto.documentId?.trim(),
      email: dto.email?.toLowerCase().trim(),
      emergencyContactName: dto.emergencyContactName?.trim(),
      emergencyContactPhone: dto.emergencyContactPhone?.trim(),
      firstName: dto.firstName?.trim(),
      gender: dto.gender,
      lastName: dto.lastName?.trim(),
      medicalAlerts: dto.medicalAlerts?.trim(),
      notes: dto.notes?.trim(),
      occupation: dto.occupation?.trim(),
      phone: dto.phone?.trim(),
    }) as Prisma.PatientUncheckedUpdateInput;
  }

  private async generatePatientCode(): Promise<string> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const count = await this.prisma.patient.count({
      where: { createdAt: { gte: start, lt: end } },
    });
    const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");

    return `PAC-${yyyymmdd}-${String(count + 1).padStart(4, "0")}`;
  }
}
