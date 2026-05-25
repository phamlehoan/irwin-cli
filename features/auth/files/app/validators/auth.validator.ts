import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class LoginValidator {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RegisterUserValidator {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(6, { message: "Password must be at least 6 characters" })
  password!: string;

  @IsString()
  @MinLength(6)
  passwordConfirmation!: string;
}

export class UpdatePasswordValidator {
  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(6)
  passwordConfirmation!: string;

  @IsOptional()
  @IsString()
  oldPassword?: string;
}
