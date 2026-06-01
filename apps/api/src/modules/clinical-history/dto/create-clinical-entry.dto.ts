import { ClinicalEntryType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateClinicalEntryDto {
  @IsEnum(ClinicalEntryType)
  type!: ClinicalEntryType;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  notes!: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}
