import { InventoryMovementType } from "@prisma/client";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class CreateInventoryMovementDto {
  @IsUUID()
  itemId!: string;

  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
