import { ToothStatus } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpsertToothStateDto {
  @IsInt()
  @Min(11)
  @Max(85)
  toothNumber!: number;

  @IsEnum(ToothStatus)
  status!: ToothStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
