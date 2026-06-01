import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types";
import { RegisterMediaAssetDto } from "./dto/register-media-asset.dto";
import { MediaService } from "./media.service";

@Controller("media")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  findByPatient(@Query("patientId") patientId: string) {
    return this.mediaService.findByPatient(patientId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTION)
  register(
    @Body() dto: RegisterMediaAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.register(dto, user.id);
  }
}
