import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { UpdateClinicSettingsDto } from "./dto/update-clinic-settings.dto";

const PRIMARY_SETTINGS_ID = "primary";

@Injectable()
export class SettingsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  getClinicSettings() {
    return this.prisma.clinicSettings.upsert({
      create: { id: PRIMARY_SETTINGS_ID },
      update: {},
      where: { id: PRIMARY_SETTINGS_ID },
    });
  }

  async updateClinicSettings(
    dto: UpdateClinicSettingsDto,
    actorId: string,
  ) {
    const existing = await this.getClinicSettings();
    const data = withoutUndefined({
      address: normalizeOptional(dto.address),
      appointmentDurationMin: dto.appointmentDurationMin,
      clinicName: dto.clinicName?.trim(),
      currency: dto.currency?.trim().toUpperCase(),
      email: normalizeOptional(dto.email)?.toLowerCase(),
      phone: normalizeOptional(dto.phone),
      taxId: normalizeOptional(dto.taxId),
      timezone: dto.timezone?.trim(),
    }) as Prisma.ClinicSettingsUpdateInput;

    const settings = await this.prisma.clinicSettings.update({
      data,
      where: { id: PRIMARY_SETTINGS_ID },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      actorId,
      after: {
        appointmentDurationMin: settings.appointmentDurationMin,
        clinicName: settings.clinicName,
        currency: settings.currency,
        timezone: settings.timezone,
      },
      before: {
        appointmentDurationMin: existing.appointmentDurationMin,
        clinicName: existing.clinicName,
        currency: existing.currency,
        timezone: existing.timezone,
      },
      entity: "ClinicSettings",
      entityId: PRIMARY_SETTINGS_ID,
    });

    return settings;
  }
}

function normalizeOptional(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
