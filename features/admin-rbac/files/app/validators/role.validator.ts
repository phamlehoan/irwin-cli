import { Transform } from "class-transformer";
import { IsOptional, IsString, MinLength } from "class-validator";

const toArray = (v: unknown): string[] =>
  Array.isArray(v) ? v : v ? [String(v)] : [];

export class RoleCreateValidator {
  @IsString()
  @MinLength(1, { message: "Code is required" })
  code!: string;

  @IsString()
  @MinLength(1, { message: "Name is required" })
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class RoleUpdateValidator {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  permissionIds?: string[];
}
