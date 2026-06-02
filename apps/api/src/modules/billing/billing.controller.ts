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
import { BillingService } from "./billing.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";

@Controller("billing")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get("payments")
  findPayments(@Query("patientId") patientId?: string) {
    return this.billingService.findPayments(patientId);
  }

  @Post("payments")
  @Roles(UserRole.ADMIN, UserRole.RECEPTION)
  createPayment(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.createPayment(dto, user.id);
  }

  @Patch("payments/:id")
  @Roles(UserRole.ADMIN, UserRole.RECEPTION)
  updatePayment(
    @Param("id") id: string,
    @Body() dto: UpdatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.updatePayment(id, dto, user.id);
  }

  @Delete("payments/:id")
  @Roles(UserRole.ADMIN, UserRole.RECEPTION)
  removePayment(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.softDeletePayment(id, user.id);
  }
}
