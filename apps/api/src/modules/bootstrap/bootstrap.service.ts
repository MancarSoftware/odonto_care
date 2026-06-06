import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config.get<string>("BOOTSTRAP_ADMIN_EMAIL");
    const password = this.config.get<string>("BOOTSTRAP_ADMIN_PASSWORD");

    if (!email || !password) {
      return;
    }

    const usersCount = await this.prisma.user.count();
    if (usersCount > 0) {
      return;
    }

    await this.prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        fullName: "Administrador OdontoCare",
        passwordHash: await bcrypt.hash(password, 12),
        role: UserRole.ADMIN,
      },
    });

    this.logger.log("Cuenta administradora inicial creada");
  }
}
