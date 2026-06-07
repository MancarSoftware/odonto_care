import { InventoryItemType } from "@prisma/client";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class CreateInventoryItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @IsEnum(InventoryItemType)
  type!: InventoryItemType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  unit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  openingStock?: number;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
