import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types";
import { UpdateClinicSettingsDto } from "./dto/update-clinic-settings.dto";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("clinic")
  getClinicSettings() {
    return this.settingsService.getClinicSettings();
  }

  @Patch("clinic")
  @Roles(UserRole.ADMIN)
  updateClinicSettings(
    @Body() dto: UpdateClinicSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateClinicSettings(dto, user.id);
  }
}
