import { ClinicalEntryType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateClinicalEntryDto {
  @IsOptional()
  @IsEnum(ClinicalEntryType)
  type?: ClinicalEntryType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
