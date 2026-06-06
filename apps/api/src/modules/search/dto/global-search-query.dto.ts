import { IsString, MaxLength, MinLength } from "class-validator";

export class GlobalSearchQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  q!: string;
}
