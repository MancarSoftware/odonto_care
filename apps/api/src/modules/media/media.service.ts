import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir } from "node:fs/promises";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterMediaAssetDto } from "./dto/register-media-asset.dto";

@Injectable()
export class MediaService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  findByPatient(patientId: string) {
    return this.prisma.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      where: { patientId, deletedAt: null },
    });
  }

  async register(dto: RegisterMediaAssetDto, actorId: string) {
    await mkdir(this.config.getOrThrow<string>("UPLOADS_DIR"), {
      recursive: true,
    });

    return this.prisma.mediaAsset.create({
      data: withoutUndefined({
        filePath: dto.filePath,
        label: dto.label?.trim(),
        mimeType: dto.mimeType,
        patientId: dto.patientId,
        sizeBytes: dto.sizeBytes,
        type: dto.type,
        uploadedById: actorId,
      }),
    });
  }
}
