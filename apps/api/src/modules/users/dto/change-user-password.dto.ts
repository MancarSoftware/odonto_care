import { IsString, MinLength } from "class-validator";

export class ChangeUserPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
