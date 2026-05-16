import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class CreateUserValidator {
  @IsString()
  @MinLength(1, { message: "First name is required" })
  firstName!: string;

  @IsString()
  @MinLength(1, { message: "Last name is required" })
  lastName!: string;

  @IsEmail({}, { message: "Invalid email" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  password!: string;
}

export class UpdateUserValidator {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: "Invalid email" })
  email?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "PENDING"], {
    message: "Status must be ACTIVE, INACTIVE or PENDING",
  })
  status?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  password?: string;
}
