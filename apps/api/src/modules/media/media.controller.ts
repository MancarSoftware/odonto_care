import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MediaType, UserRole } from "@prisma/client";
import type { Response } from "express";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types";
import { RegisterMediaAssetDto } from "./dto/register-media-asset.dto";
import { MediaService } from "./media.service";
import type { UploadedMediaFile } from "./media.service";

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

  @Post("upload")
  @Roles(UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTION)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 35_000_000 } }))
  upload(
    @UploadedFile() file: UploadedMediaFile,
    @Body("patientId") patientId: string,
    @Body("type") type: MediaType,
    @Body("label") label: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.mediaService.upload(file, { label, patientId, type }, user.id);
  }

  @Get(":id/file")
  async openFile(@Param("id") id: string, @Res() response: Response) {
    const asset = await this.mediaService.findFile(id);

    return response.sendFile(asset.filePath);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN, UserRole.DENTIST, UserRole.RECEPTION)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.softDelete(id, user.id);
  }
}
