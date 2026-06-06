import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(3333),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("8h"),
  UPLOADS_DIR: z.string().default("C:/OdontoSystem/uploads"),
  BACKUPS_DIR: z.string().default("C:/OdontoSystem/backups"),
  POSTGRES_CONTAINER: z.string().default("odontocare-postgres"),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  return envSchema.parse(config);
}
