import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import type { Response } from "express";
import { diskStorage } from "multer";
import { tmpdir } from "node:os";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/types";
import {
  BackupsService,
  type ImportedBackupFile,
} from "./backups.service";
import { UpdateBackupSettingsDto } from "./dto/update-backup-settings.dto";

@Controller("backups")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get("settings")
  getSettings() {
    return this.backupsService.getSettings();
  }

  @Patch("settings")
  updateSettings(
    @Body() dto: UpdateBackupSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.backupsService.updateSettings(dto, user.id);
  }

  @Get()
  findAll() {
    return this.backupsService.findAll();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser) {
    return this.backupsService.createManualBackup(user.id);
  }

  @Post("import")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 1_073_741_824 },
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_request, file, callback) => {
          callback(
            null,
            `odontocare-import-${randomUUID()}${extname(file.originalname) || ".zip"}`,
          );
        },
      }),
    }),
  )
  importBackup(
    @UploadedFile() file: ImportedBackupFile,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.backupsService.importBackup(file, user.id);
  }

  @Post(":id/restore")
  restore(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.backupsService.restore(id, user.id);
  }

  @Get(":id/download")
  async download(@Param("id") id: string, @Res() response: Response) {
    const backup = await this.backupsService.getDownload(id);
    return response.download(backup.filePath, backup.fileName);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.backupsService.delete(id, user.id);
  }
}
