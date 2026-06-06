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

  findRecent(limit: number) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        action: true,
        actor: {
          select: {
            email: true,
            fullName: true,
            id: true,
            role: true,
          },
        },
        after: true,
        before: true,
        createdAt: true,
        entity: true,
        entityId: true,
        id: true,
      },
      take: limit,
    });
  }

  log(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: input,
      select: { id: true },
    });
  }
}
