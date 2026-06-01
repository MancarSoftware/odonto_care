import { Injectable } from "@nestjs/common";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { UpsertToothStateDto } from "./dto/upsert-tooth-state.dto";

@Injectable()
export class OdontogramService {
  constructor(private readonly prisma: PrismaService) {}

  findByPatient(patientId: string) {
    return this.prisma.odontogramTooth.findMany({
      orderBy: { toothNumber: "asc" },
      where: { patientId },
    });
  }

  async upsertTooth(
    patientId: string,
    toothNumber: number,
    dto: UpsertToothStateDto,
    actorId: string,
  ) {
    const state = await this.prisma.odontogramTooth.upsert({
      create: withoutUndefined({
        notes: dto.notes?.trim(),
        patientId,
        status: dto.status,
        toothNumber,
        updatedById: actorId,
      }),
      update: withoutUndefined({
        notes: dto.notes?.trim(),
        status: dto.status,
        updatedById: actorId,
      }),
      where: { patientId_toothNumber: { patientId, toothNumber } },
    });

    await this.prisma.toothEvent.create({
      data: withoutUndefined({
        authorId: actorId,
        notes: dto.notes?.trim(),
        patientId,
        status: dto.status,
        toothNumber,
      }),
    });

    return state;
  }
}
