import { MediaType } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class RegisterMediaAssetDto {
  @IsUUID()
  patientId!: string;

  @IsEnum(MediaType)
  type!: MediaType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsString()
  filePath!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}
