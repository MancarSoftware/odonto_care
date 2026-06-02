import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnv } from "./config/env";
import { PrismaModule } from "./prisma/prisma.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BillingModule } from "./modules/billing/billing.module";
import { ClinicalHistoryModule } from "./modules/clinical-history/clinical-history.module";
import { HealthModule } from "./modules/health/health.module";
import { MediaModule } from "./modules/media/media.module";
import { OdontogramModule } from "./modules/odontogram/odontogram.module";
import { PatientsModule } from "./modules/patients/patients.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { TreatmentsModule } from "./modules/treatments/treatments.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: [".env", "../../.env"],
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuditModule,
    UsersModule,
    AuthModule,
    PatientsModule,
    ClinicalHistoryModule,
    AppointmentsModule,
    OdontogramModule,
    TreatmentsModule,
    BillingModule,
    MediaModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
