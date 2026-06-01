import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { AuthenticatedUser } from "../../modules/auth/types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    return request.user;
  },
);
