import { BackupFrequency } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateBackupSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  backupDirectory?: string;

  @IsOptional()
  @IsBoolean()
  automaticEnabled?: boolean;

  @IsOptional()
  @IsEnum(BackupFrequency)
  frequency?: BackupFrequency;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  scheduledHour?: number;

  @IsOptional()
  @IsBoolean()
  includeUploads?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  retentionCount?: number;
}
