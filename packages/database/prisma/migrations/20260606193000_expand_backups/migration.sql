CREATE TYPE "BackupFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "BackupOperation" AS ENUM ('BACKUP', 'RESTORE');
CREATE TYPE "BackupSource" AS ENUM ('MANUAL', 'AUTOMATIC', 'IMPORTED', 'SAFETY');

ALTER TABLE "backup_jobs"
ADD COLUMN "operation" "BackupOperation" NOT NULL DEFAULT 'BACKUP',
ADD COLUMN "source" "BackupSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "file_name" VARCHAR(240),
ADD COLUMN "size_bytes" BIGINT,
ADD COLUMN "includes_uploads" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "actor_id" UUID;

DROP INDEX IF EXISTS "backup_jobs_status_created_at_idx";
CREATE INDEX "backup_jobs_operation_status_created_at_idx"
ON "backup_jobs"("operation", "status", "created_at");
CREATE INDEX "backup_jobs_source_created_at_idx"
ON "backup_jobs"("source", "created_at");

ALTER TABLE "backup_jobs"
ADD CONSTRAINT "backup_jobs_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "backup_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'primary',
    "backup_directory" TEXT NOT NULL DEFAULT 'C:/OdontoSystem/backups',
    "automatic_enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "BackupFrequency" NOT NULL DEFAULT 'DAILY',
    "scheduled_hour" INTEGER NOT NULL DEFAULT 2,
    "include_uploads" BOOLEAN NOT NULL DEFAULT true,
    "retention_count" INTEGER NOT NULL DEFAULT 14,
    "last_automatic_backup_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "backup_settings"
ADD CONSTRAINT "backup_settings_scheduled_hour_check"
CHECK ("scheduled_hour" BETWEEN 0 AND 23);

ALTER TABLE "backup_settings"
ADD CONSTRAINT "backup_settings_retention_count_check"
CHECK ("retention_count" BETWEEN 1 AND 100);

INSERT INTO "backup_settings" ("id") VALUES ('primary');
