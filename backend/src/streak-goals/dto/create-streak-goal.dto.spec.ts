import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { STREAK_GOAL_NAME_MAX_LENGTH } from '../streak-goals.config';
import { CreateStreakGoalDto } from './create-streak-goal.dto';

// The pipe configured as in main.ts, so these tests see what a request sees.
const validate = (body: unknown) =>
  new ValidationPipe().transform(body, {
    type: 'body',
    metatype: CreateStreakGoalDto,
  });

describe('CreateStreakGoalDto', () => {
  it('accepts a name', async () => {
    await expect(validate({ name: 'Papierosy' })).resolves.toBeDefined();
  });

  it('accepts a name of the maximum length', async () => {
    const name = 'x'.repeat(STREAK_GOAL_NAME_MAX_LENGTH);

    await expect(validate({ name })).resolves.toBeDefined();
  });

  it('counts the length after trimming', async () => {
    const name = `  ${'x'.repeat(STREAK_GOAL_NAME_MAX_LENGTH)}  `;

    await expect(validate({ name })).resolves.toBeDefined();
  });

  it.each([
    ['an empty name', { name: '' }],
    ['a name of spaces', { name: '   ' }],
    ['a missing name', {}],
    ['a name that is not text', { name: 42 }],
    ['a name that is too long', { name: 'x'.repeat(41) }],
  ])('rejects %s', async (_, body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
