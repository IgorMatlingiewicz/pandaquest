import { ValidationPipe } from '@nestjs/common';

/**
 * The one ValidationPipe of the API, registered as APP_PIPE in AppModule,
 * so the server and the e2e tests run the very same one.
 *
 * whitelist: a field without a class-validator decorator in the DTO is
 * dropped before the controller sees it. Several services copy the DTO
 * into Prisma (`...dto`), so without it a body could set any column of the
 * row: the owner of a category, a task's status, its creation date.
 *
 * Not forbidNonWhitelisted: an unknown field is ignored, not refused, so an
 * older app that still sends a field the API no longer takes keeps working.
 * Not transform: parameters and query strings keep their types as sent, as
 * they always have.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({ whitelist: true });
}
