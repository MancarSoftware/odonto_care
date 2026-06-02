import { ToothStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class UpsertToothStateDto {
  @IsEnum(ToothStatus)
  status!: ToothStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
