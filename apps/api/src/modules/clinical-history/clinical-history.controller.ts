import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types";
import { ClinicalHistoryService } from "./clinical-history.service";
import { CreateClinicalEntryDto } from "./dto/create-clinical-entry.dto";
import { UpdateClinicalEntryDto } from "./dto/update-clinical-entry.dto";

@Controller("patients/:patientId/clinical-history")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClinicalHistoryController {
  constructor(private readonly clinicalHistoryService: ClinicalHistoryService) {}

  @Get()
  findByPatient(@Param("patientId") patientId: string) {
    return this.clinicalHistoryService.findByPatient(patientId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DENTIST)
  create(
    @Param("patientId") patientId: string,
    @Body() dto: CreateClinicalEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicalHistoryService.create(patientId, dto, user.id);
  }

  @Patch(":entryId")
  @Roles(UserRole.ADMIN, UserRole.DENTIST)
  update(
    @Param("patientId") patientId: string,
    @Param("entryId") entryId: string,
    @Body() dto: UpdateClinicalEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicalHistoryService.update(patientId, entryId, dto, user.id);
  }

  @Delete(":entryId")
  @Roles(UserRole.ADMIN, UserRole.DENTIST)
  remove(
    @Param("patientId") patientId: string,
    @Param("entryId") entryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicalHistoryService.softDelete(patientId, entryId, user.id);
  }
}
