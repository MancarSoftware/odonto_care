import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";

import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import type { JwtPayload, LoginResponse } from "./types";

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<
    string,
    { blockedUntil?: number; count: number; windowStartedAt: number }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const email = dto.email.toLowerCase().trim();
    this.ensureLoginAllowed(email);
    const user = await this.usersService.findCredentialsByEmail(email);

    if (!user || !user.isActive || user.deletedAt) {
      this.registerFailedLogin(email);
      throw new UnauthorizedException("Credenciales invalidas");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      this.registerFailedLogin(email);
      throw new UnauthorizedException("Credenciales invalidas");
    }

    this.loginAttempts.delete(email);
    await this.usersService.markLogin(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  private ensureLoginAllowed(email: string) {
    const attempt = this.loginAttempts.get(email);
    if (!attempt) return;

    const now = Date.now();
    if (attempt.blockedUntil && attempt.blockedUntil > now) {
      throw new HttpException(
        "Demasiados intentos. Espera unos minutos antes de volver a intentar",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (now - attempt.windowStartedAt > 10 * 60 * 1000) {
      this.loginAttempts.delete(email);
    }
  }

  private registerFailedLogin(email: string) {
    const now = Date.now();
    const existing = this.loginAttempts.get(email);
    const attempt =
      existing && now - existing.windowStartedAt <= 10 * 60 * 1000
        ? existing
        : { count: 0, windowStartedAt: now };

    attempt.count += 1;
    if (attempt.count >= 5) {
      attempt.blockedUntil = now + 5 * 60 * 1000;
    }

    this.loginAttempts.set(email, attempt);
  }
}
