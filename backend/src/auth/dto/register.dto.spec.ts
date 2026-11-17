import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './register.dto';

// The pipe configured as in main.ts, so these tests see what a request sees.
const validate = (body: unknown) =>
  new ValidationPipe().transform(body, { type: 'body', metatype: RegisterDto });

const VALID = {
  email: 'new@example.com',
  username: 'newbie',
  password: 'haslo12345',
};

describe('RegisterDto: language', () => {
  it.each(['pl', 'en'])('accepts %s', async (language) => {
    await expect(validate({ ...VALID, language })).resolves.toBeDefined();
  });

  it('may be left out, as by older apps', async () => {
    await expect(validate(VALID)).resolves.toBeDefined();
  });

  it.each([
    ['a language the app does not have', 'de'],
    ['a capitalised code', 'EN'],
    ['a full locale', 'en-US'],
    ['a number', 1],
  ])('rejects %s', async (_, language) => {
    await expect(validate({ ...VALID, language })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
