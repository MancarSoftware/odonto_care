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
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";

@Controller("appointments")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get("doctors")
  findDoctors() {
    return this.appointmentsService.findDoctors();
  }

  @Get()
  findRange(@Query("from") from?: string, @Query("to") to?: string) {
    return this.appointmentsService.findRange({ from, to });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTION)
  create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.create(dto, user);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTION)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.update(id, dto, user.id);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTION)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.appointmentsService.softDelete(id, user.id);
  }
}
