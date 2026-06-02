import { IsDateString, IsOptional } from "class-validator";

export class ReportSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
