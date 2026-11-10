import { applyDecorators } from '@nestjs/common';
import * as argon2 from 'argon2';
import { IsString, MinLength } from 'class-validator';

/*
 * Everything about passwords in one place: how they are hashed and checked,
 * and what a newly chosen one must look like. Registration and the password
 * change use the same rule, so they cannot drift apart.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** A salted argon2 hash; the same password gives a different hash each time. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(hash, password);
}

/** The rule for a password the user is choosing: at registration or a change. */
export function IsNewPassword(): PropertyDecorator {
  return applyDecorators(IsString(), MinLength(PASSWORD_MIN_LENGTH));
}
