import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { ClinicalHistoryController } from "./clinical-history.controller";
import { ClinicalHistoryService } from "./clinical-history.service";

@Module({
  imports: [AuditModule],
  controllers: [ClinicalHistoryController],
  providers: [ClinicalHistoryService],
  exports: [ClinicalHistoryService],
})
export class ClinicalHistoryModule {}
