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
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { PatientsService } from "./patients.service";

@Controller("patients")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  findAll(@Query("q") q?: string) {
    return this.patientsService.findAll({ q });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.patientsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTION)
  create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.create(dto, user.id);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTION)
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.update(id, dto, user.id);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.softDelete(id, user.id);
  }
}
