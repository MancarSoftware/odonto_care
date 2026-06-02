import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, PaymentStatus, Prisma } from "@prisma/client";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";

const paymentInclude = {
  patient: {
    select: { id: true, code: true, firstName: true, lastName: true },
  },
  treatment: {
    select: { id: true, name: true, status: true },
  },
} satisfies Prisma.PaymentInclude;

@Injectable()
export class BillingService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  findPayments(patientId?: string) {
    return this.prisma.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: 100,
      where: withoutUndefined({
        deletedAt: null,
        patientId,
      }),
      include: paymentInclude,
    });
  }

  async createPayment(dto: CreatePaymentDto, actorId: string) {
    await this.ensurePatientExists(dto.patientId);

    if (dto.treatmentId) {
      await this.ensureTreatmentExists(dto.treatmentId, dto.patientId);
    }

    const payment = await this.prisma.payment.create({
      data: withoutUndefined({
        amount: dto.amount,
        createdById: actorId,
        method: dto.method,
        notes: dto.notes?.trim(),
        patientId: dto.patientId,
        reference: dto.reference?.trim(),
        status: dto.status ?? PaymentStatus.PAID,
        treatmentId: dto.treatmentId,
      }),
      include: paymentInclude,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      actorId,
      after: {
        amount: payment.amount,
        patientId: payment.patientId,
        status: payment.status,
      },
      entity: "Payment",
      entityId: payment.id,
    });

    return payment;
  }

  async updatePayment(id: string, dto: UpdatePaymentDto, actorId: string) {
    const existing = await this.ensurePaymentExists(id);

    if (dto.treatmentId) {
      await this.ensureTreatmentExists(dto.treatmentId, existing.patientId);
    }

    const payment = await this.prisma.payment.update({
      data: withoutUndefined({
        amount: dto.amount,
        method: dto.method,
        notes: dto.notes?.trim(),
        reference: dto.reference?.trim(),
        status: dto.status,
        treatmentId: dto.treatmentId,
      }),
      include: paymentInclude,
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      actorId,
      after: { amount: payment.amount, status: payment.status },
      before: { amount: existing.amount, status: existing.status },
      entity: "Payment",
      entityId: id,
    });

    return payment;
  }

  async softDeletePayment(id: string, actorId: string) {
    const existing = await this.ensurePaymentExists(id);

    await this.prisma.payment.update({
      data: { deletedAt: new Date() },
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      actorId,
      before: { amount: existing.amount, status: existing.status },
      entity: "Payment",
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

  private async ensureTreatmentExists(treatmentId: string, patientId: string) {
    const treatment = await this.prisma.treatment.findFirst({
      select: { id: true },
      where: { id: treatmentId, patientId, deletedAt: null },
    });

    if (!treatment) {
      throw new NotFoundException("Tratamiento no encontrado");
    }
  }

  private async ensurePaymentExists(id: string) {
    const payment = await this.prisma.payment.findFirst({
      select: {
        amount: true,
        id: true,
        patientId: true,
        status: true,
      },
      where: { id, deletedAt: null },
    });

    if (!payment) {
      throw new NotFoundException("Pago no encontrado");
    }

    return payment;
  }
}
