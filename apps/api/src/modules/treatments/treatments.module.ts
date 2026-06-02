import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { TreatmentsController } from "./treatments.controller";
import { TreatmentsService } from "./treatments.service";

@Module({
  imports: [AuditModule],
  controllers: [TreatmentsController],
  providers: [TreatmentsService],
  exports: [TreatmentsService],
})
export class TreatmentsModule {}
