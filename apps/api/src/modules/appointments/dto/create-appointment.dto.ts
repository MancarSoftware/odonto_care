import { AppointmentStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateAppointmentDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  color?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
