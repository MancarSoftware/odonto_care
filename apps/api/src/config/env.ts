import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(3333),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("8h"),
  UPLOADS_DIR: z.string().default("C:/OdontoSystem/uploads"),
  BACKUPS_DIR: z.string().default("C:/OdontoSystem/backups"),
  DATABASE_TOOLS_MODE: z.enum(["docker", "native"]).default("docker"),
  PG_BIN_DIR: z.string().default(""),
  POSTGRES_CONTAINER: z.string().default("odontocare-postgres"),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  return envSchema.parse(config);
}
