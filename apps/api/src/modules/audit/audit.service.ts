import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

type AuditInput = {
  actorId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: input,
      select: { id: true },
    });
  }
}
