import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { CreateInventoryMovementDto } from "./dto/create-inventory-movement.dto";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("summary")
  getSummary() {
    return this.inventoryService.getSummary();
  }

  @Get("items")
  findItems(@Query("query") query?: string) {
    return this.inventoryService.findItems(query);
  }

  @Post("items")
  @Roles(UserRole.ADMIN, UserRole.RECEPTION)
  createItem(
    @Body() dto: CreateInventoryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.createItem(dto, user.id);
  }

  @Patch("items/:id")
  @Roles(UserRole.ADMIN, UserRole.RECEPTION)
  updateItem(
    @Param("id") id: string,
    @Body() dto: UpdateInventoryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.updateItem(id, dto, user.id);
  }

  @Delete("items/:id")
  @Roles(UserRole.ADMIN, UserRole.RECEPTION)
  removeItem(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.softDeleteItem(id, user.id);
  }

  @Get("movements")
  findMovements(@Query("itemId") itemId?: string) {
    return this.inventoryService.findMovements(itemId);
  }

  @Post("movements")
  @Roles(UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTION)
  createMovement(
    @Body() dto: CreateInventoryMovementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.createMovement(dto, user);
  }

  @Get("suppliers")
  findSuppliers() {
    return this.inventoryService.findSuppliers();
  }

  @Post("suppliers")
  @Roles(UserRole.ADMIN, UserRole.RECEPTION)
  createSupplier(
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.createSupplier(dto, user.id);
  }

  @Patch("suppliers/:id")
  @Roles(UserRole.ADMIN, UserRole.RECEPTION)
  updateSupplier(
    @Param("id") id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.updateSupplier(id, dto, user.id);
  }

  @Delete("suppliers/:id")
  @Roles(UserRole.ADMIN, UserRole.RECEPTION)
  removeSupplier(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.softDeleteSupplier(id, user.id);
  }
}
