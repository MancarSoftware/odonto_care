import { Injectable } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  findPayments(patientId?: string) {
    return this.prisma.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: 100,
      where: withoutUndefined({
        deletedAt: null,
        patientId,
      }),
      include: {
        patient: {
          select: { id: true, code: true, firstName: true, lastName: true },
        },
        treatment: {
          select: { id: true, name: true, status: true },
        },
      },
    });
  }

  createPayment(dto: CreatePaymentDto, actorId: string) {
    return this.prisma.payment.create({
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
    });
  }
}
