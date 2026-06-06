import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { withoutUndefined } from "../../common/utils/without-undefined";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
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
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

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

  async create(dto: CreateUserDto, actorId: string) {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          fullName: dto.fullName.trim(),
          passwordHash,
          role: dto.role ?? UserRole.RECEPTION,
        },
        select: safeUserSelect,
      });

      await this.audit.log({
        action: AuditAction.CREATE,
        actorId,
        after: { email: user.email, fullName: user.fullName, role: user.role },
        entity: "User",
        entityId: user.id,
      });

      return user;
    } catch (error) {
      this.handleUniqueEmail(error);
    }
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const existing = await this.ensureUserExists(id);

    if (id === actorId && dto.isActive === false) {
      throw new BadRequestException("No puedes desactivar tu propia cuenta");
    }

    if (
      existing.role === UserRole.ADMIN &&
      (dto.role !== undefined && dto.role !== UserRole.ADMIN ||
        dto.isActive === false)
    ) {
      await this.ensureAnotherActiveAdmin(id);
    }

    try {
      const user = await this.prisma.user.update({
        data: withoutUndefined({
          email: dto.email?.toLowerCase().trim(),
          fullName: dto.fullName?.trim(),
          isActive: dto.isActive,
          role: dto.role,
        }) as Prisma.UserUpdateInput,
        select: safeUserSelect,
        where: { id },
      });

      await this.audit.log({
        action: AuditAction.UPDATE,
        actorId,
        after: {
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive,
          role: user.role,
        },
        before: {
          email: existing.email,
          fullName: existing.fullName,
          isActive: existing.isActive,
          role: existing.role,
        },
        entity: "User",
        entityId: id,
      });

      return user;
    } catch (error) {
      this.handleUniqueEmail(error);
    }
  }

  async changePassword(id: string, password: string, actorId: string) {
    const existing = await this.ensureUserExists(id);
    const passwordHash = await bcrypt.hash(password, 12);

    await this.prisma.user.update({
      data: { passwordHash },
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      actorId,
      after: { passwordChanged: true },
      before: { email: existing.email },
      entity: "UserPassword",
      entityId: id,
    });

    return { id };
  }

  async softDelete(id: string, actorId: string) {
    const existing = await this.ensureUserExists(id);

    if (id === actorId) {
      throw new BadRequestException("No puedes eliminar tu propia cuenta");
    }

    if (existing.role === UserRole.ADMIN) {
      await this.ensureAnotherActiveAdmin(id);
    }

    await this.prisma.user.update({
      data: { deletedAt: new Date(), isActive: false },
      where: { id },
    });

    await this.audit.log({
      action: AuditAction.DELETE,
      actorId,
      before: {
        email: existing.email,
        fullName: existing.fullName,
        role: existing.role,
      },
      entity: "User",
      entityId: id,
    });

    return { id };
  }

  markLogin(id: string) {
    return this.prisma.user.update({
      data: { lastLoginAt: new Date() },
      where: { id },
      select: { id: true },
    });
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findFirst({
      select: {
        email: true,
        fullName: true,
        id: true,
        isActive: true,
        role: true,
      },
      where: { deletedAt: null, id },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    return user;
  }

  private async ensureAnotherActiveAdmin(excludedId: string) {
    const count = await this.prisma.user.count({
      where: {
        deletedAt: null,
        id: { not: excludedId },
        isActive: true,
        role: UserRole.ADMIN,
      },
    });

    if (count === 0) {
      throw new BadRequestException(
        "Debe existir al menos otro administrador activo",
      );
    }
  }

  private handleUniqueEmail(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("El correo ya esta registrado");
    }

    throw error;
  }
}
