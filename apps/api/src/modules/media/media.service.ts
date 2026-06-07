import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditAction, MediaType, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RegisterMediaAssetDto } from "./dto/register-media-asset.dto";

export type UploadedMediaFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class MediaService {
  constructor(
    private readonly audit: AuditService,
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
    const uploadsDir = resolve(
      this.config.getOrThrow<string>("UPLOADS_DIR"),
    );
    await mkdir(uploadsDir, { recursive: true });
    await this.ensurePatientExists(dto.patientId);
    const filePath = resolve(dto.filePath);
    const storedPath = relative(uploadsDir, filePath);

    if (!isPathInside(storedPath)) {
      throw new BadRequestException(
        "El archivo debe estar dentro de la carpeta de imagenes de OdontoCare",
      );
    }

    try {
      await access(filePath);
    } catch {
      throw new BadRequestException("El archivo indicado no existe");
    }

    const asset = await this.prisma.mediaAsset.create({
      data: withoutUndefined({
        filePath: storedPath,
        label: dto.label?.trim(),
        mimeType: dto.mimeType,
        patientId: dto.patientId,
        sizeBytes: dto.sizeBytes,
        type: dto.type,
        uploadedById: actorId,
      }),
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      actorId,
      after: { label: asset.label, patientId: asset.patientId, type: asset.type },
      entity: "MediaAsset",
      entityId: asset.id,
    });

    return asset;
  }

  async upload(
    file: UploadedMediaFile | undefined,
    dto: { label?: string | undefined; patientId: string; type: MediaType },
    actorId: string,
  ) {
    if (!file) {
      throw new BadRequestException("Selecciona un archivo valido");
    }

    if (!Object.values(MediaType).includes(dto.type)) {
      throw new BadRequestException("Tipo de archivo no valido");
    }

    const extension = extensionFromMime(file.mimetype);
    if (!extension) {
      throw new BadRequestException(
        "Solo se permiten imagenes JPG, PNG, WEBP o archivos PDF",
      );
    }

    if (
      (dto.type === MediaType.IMAGE || dto.type === MediaType.XRAY) &&
      !file.mimetype.startsWith("image/")
    ) {
      throw new BadRequestException(
        "El tipo seleccionado requiere un archivo de imagen",
      );
    }

    await this.ensurePatientExists(dto.patientId);

    const uploadsDir = resolve(this.config.getOrThrow<string>("UPLOADS_DIR"));
    const patientDir = join(uploadsDir, dto.patientId);
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const filePath = join(patientDir, fileName);
    const storedPath = join(dto.patientId, fileName);

    await mkdir(patientDir, { recursive: true });
    await writeFile(filePath, file.buffer);

    const data = withoutUndefined({
        filePath: storedPath,
        label: dto.label?.trim() || file.originalname,
        mimeType: file.mimetype,
        patientId: dto.patientId,
        sizeBytes: file.size,
        type: dto.type,
        uploadedById: actorId,
      }) as Prisma.MediaAssetUncheckedCreateInput;

    const asset = await this.prisma.mediaAsset.create({
      data,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      actorId,
      after: { label: asset.label, patientId: asset.patientId, type: asset.type },
      entity: "MediaAsset",
      entityId: asset.id,
    });

    return asset;
  }

  async findFile(id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      select: { filePath: true, id: true, mimeType: true },
      where: { id, deletedAt: null },
    });

    if (!asset) {
      throw new NotFoundException("Archivo no encontrado");
    }

    const filePath = await this.resolveStoredFilePath(asset.filePath);
    return { ...asset, filePath };
  }

  async softDelete(id: string, actorId: string) {
    const existing = await this.prisma.mediaAsset.findFirst({
      select: { id: true, label: true, patientId: true, type: true },
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException("Archivo no encontrado");
    }

    await this.prisma.mediaAsset.update({
      data: { deletedAt: new Date() },
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      actorId,
      before: {
        label: existing.label,
        patientId: existing.patientId,
        type: existing.type,
      },
      entity: "MediaAsset",
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

  private async resolveStoredFilePath(storedPath: string) {
    const uploadsDir = resolve(
      this.config.getOrThrow<string>("UPLOADS_DIR"),
    );
    let filePath = isAbsolute(storedPath)
      ? resolve(storedPath)
      : resolve(uploadsDir, storedPath);

    if (isAbsolute(storedPath)) {
      const storedRelativePath = relative(uploadsDir, filePath);

      if (!isPathInside(storedRelativePath)) {
        filePath = join(
          uploadsDir,
          basename(dirname(storedPath)),
          basename(storedPath),
        );
      }
    }

    const resolvedRelativePath = relative(uploadsDir, filePath);
    if (!isPathInside(resolvedRelativePath)) {
      throw new NotFoundException("Archivo no encontrado");
    }

    try {
      await access(filePath);
    } catch {
      throw new NotFoundException("Archivo no encontrado");
    }

    return filePath;
  }
}

function extensionFromMime(mimeType: string): string | null {
  if (mimeType === "application/pdf") {
    return ".pdf";
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  if (mimeType === "image/jpeg") {
    return ".jpg";
  }

  return null;
}

function isPathInside(relativePath: string) {
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}
