import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types";
import { OdontogramService } from "./odontogram.service";
import { UpsertToothStateDto } from "./dto/upsert-tooth-state.dto";

@Controller("patients/:patientId/odontogram")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OdontogramController {
  constructor(private readonly odontogramService: OdontogramService) {}

  @Get()
  findByPatient(@Param("patientId") patientId: string) {
    return this.odontogramService.findByPatient(patientId);
  }

  @Put("teeth/:toothNumber")
  @Roles(UserRole.ADMIN, UserRole.DENTIST)
  upsertTooth(
    @Param("patientId") patientId: string,
    @Param("toothNumber") toothNumber: string,
    @Body() dto: UpsertToothStateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.odontogramService.upsertTooth(
      patientId,
      Number(toothNumber),
      dto,
      user.id,
    );
  }
}
