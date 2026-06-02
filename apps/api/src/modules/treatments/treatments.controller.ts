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
import { CreateTreatmentDto } from "./dto/create-treatment.dto";
import { UpdateTreatmentDto } from "./dto/update-treatment.dto";
import { TreatmentsService } from "./treatments.service";

@Controller("treatments")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TreatmentsController {
  constructor(private readonly treatmentsService: TreatmentsService) {}

  @Get()
  findAll(@Query("patientId") patientId?: string) {
    return this.treatmentsService.findAll(patientId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DENTIST)
  create(@Body() dto: CreateTreatmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.treatmentsService.create(dto, user.id);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.DENTIST)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTreatmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.treatmentsService.update(id, dto, user.id);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN, UserRole.DENTIST)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.treatmentsService.softDelete(id, user.id);
  }
}
