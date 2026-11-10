import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from './password';

// The pipe configured as in main.ts, so these tests see what a request sees.
const validate = (metatype: new () => object, body: unknown) =>
  new ValidationPipe().transform(body, { type: 'body', metatype });

describe('password', () => {
  describe('hashPassword and verifyPassword', () => {
    it('stores no plain text and accepts only the right password', async () => {
      const hash = await hashPassword('haslo12345');

      expect(hash).not.toContain('haslo12345');
      expect(await verifyPassword(hash, 'haslo12345')).toBe(true);
      expect(await verifyPassword(hash, 'haslo12346')).toBe(false);
    });

    it('salts: the same password gives two different hashes', async () => {
      const [first, second] = await Promise.all([
        hashPassword('haslo12345'),
        hashPassword('haslo12345'),
      ]);

      expect(first).not.toBe(second);
    });
  });

  describe('the rule for a new password, shared by both forms', () => {
    const shortest = 'a'.repeat(PASSWORD_MIN_LENGTH);
    const tooShort = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);

    const forms: [string, new () => object, (password: unknown) => object][] = [
      [
        'registration',
        RegisterDto,
        (password) => ({
          email: 'new@example.com',
          username: 'newbie',
          password,
        }),
      ],
      [
        'password change',
        ChangePasswordDto,
        (newPassword) => ({ currentPassword: 'x', newPassword }),
      ],
    ];

    it('is eight characters', () => {
      expect(PASSWORD_MIN_LENGTH).toBe(8);
    });

    describe.each(forms)('%s', (_, dto, body) => {
      it('lets a password of exactly the minimum length through', async () => {
        await expect(validate(dto, body(shortest))).resolves.toEqual(
          body(shortest),
        );
      });

      it.each([
        ['one character too short', tooShort],
        ['empty', ''],
        ['not text', 12345678],
        ['missing', undefined],
      ])('refuses a password that is %s', async (__, password) => {
        await expect(validate(dto, body(password))).rejects.toBeInstanceOf(
          BadRequestException,
        );
      });
    });

    it('takes any text as the current password: checking it is the service job', async () => {
      const body = { currentPassword: '', newPassword: shortest };

      await expect(validate(ChangePasswordDto, body)).resolves.toEqual(body);
    });
  });
});
