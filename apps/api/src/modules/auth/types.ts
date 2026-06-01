import { UserRole } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthenticatedUser;
};
