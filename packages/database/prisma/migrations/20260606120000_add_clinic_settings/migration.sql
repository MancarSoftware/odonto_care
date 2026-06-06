CREATE TABLE "clinic_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'primary',
    "clinic_name" VARCHAR(160) NOT NULL DEFAULT 'OdontoCare',
    "tax_id" VARCHAR(40),
    "phone" VARCHAR(40),
    "email" VARCHAR(180),
    "address" VARCHAR(240),
    "currency" VARCHAR(8) NOT NULL DEFAULT 'USD',
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'America/Guayaquil',
    "appointment_duration_min" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "clinic_settings" ("id") VALUES ('primary');
