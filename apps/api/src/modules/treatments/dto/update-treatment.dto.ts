import { TreatmentStatus } from "@prisma/client";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateTreatmentDto {
  @IsOptional()
  @IsNumber()
  @Min(11)
  @Max(85)
  toothNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TreatmentStatus)
  status?: TreatmentStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;
}
