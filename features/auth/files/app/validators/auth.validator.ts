import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginValidator {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  password!: string;
}
