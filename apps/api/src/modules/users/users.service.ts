import { Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { PrismaService } from "../../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import type { AuthenticatedUser } from "../auth/types";

const safeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { fullName: "asc" },
      select: safeUserSelect,
      where: { deletedAt: null },
    });
  }

  findCredentialsByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findSafeById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
      where: { id, deletedAt: null, isActive: true },
    });

    return user;
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        fullName: dto.fullName.trim(),
        passwordHash,
        role: dto.role ?? UserRole.RECEPTION,
      },
      select: safeUserSelect,
    });
  }

  markLogin(id: string) {
    return this.prisma.user.update({
      data: { lastLoginAt: new Date() },
      where: { id },
      select: { id: true },
    });
  }
}
