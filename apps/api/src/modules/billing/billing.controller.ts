import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types";
import { BillingService } from "./billing.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";

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
}
