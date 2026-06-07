import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  taxId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
