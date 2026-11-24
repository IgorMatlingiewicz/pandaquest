import { BadRequestException } from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { CreateCategoryDto } from '../category/dto/create-category.dto';
import { ReorderDto } from './dto/reorder.dto';
import { CreateStreakGoalDto } from '../streak-goals/dto/create-streak-goal.dto';
import { createValidationPipe } from './validation-pipe';

class OptionalOnlyDto {
  @IsString()
  name!: string;

  // Nothing but @IsOptional(): does whitelist keep it?
  @IsOptional()
  note?: unknown;
}

class NumberDto {
  @IsInt()
  count!: number;
}

const run = (metatype: new () => unknown, body: unknown) =>
  createValidationPipe().transform(body, { type: 'body', metatype });

describe('createValidationPipe', () => {
  it('drops the fields the DTO does not declare', async () => {
    const body = {
      name: 'Sport',
      userId: 'someone-else',
      cycleType: 'DAILY',
      isDeletable: false,
    };

    await expect(run(CreateCategoryDto, body)).resolves.toEqual({
      name: 'Sport',
    });
  });

  it('keeps a field whose only decorator is @IsOptional()', async () => {
    // class-validator counts @IsOptional() as a decorator of the property,
    // so whitelist does not drop it; with no value it is skipped, with a
    // value of any type it goes through.
    await expect(
      run(OptionalOnlyDto, { name: 'a', note: { any: 1 } }),
    ).resolves.toEqual({ name: 'a', note: { any: 1 } });
    await expect(run(OptionalOnlyDto, { name: 'a' })).resolves.toEqual({
      name: 'a',
    });
  });

  it('drops undeclared fields inside nested DTOs too', async () => {
    const body = { items: [{ id: 't1', order: 0, userId: 'someone-else' }] };

    await expect(run(ReorderDto, body)).resolves.toEqual({
      items: [{ id: 't1', order: 0 }],
    });
  });

  it('still refuses invalid values, and converts no types', async () => {
    await expect(run(NumberDto, { count: '3' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(run(NumberDto, { count: 3 })).resolves.toEqual({ count: 3 });
  });

  it('hands on the validated copy: the trimmed quit streak name', async () => {
    // Without whitelist the pipe returned the body as sent; with it, the
    // checked copy, so @Transform's trim now reaches the service as well.
    await expect(
      run(CreateStreakGoalDto, { name: '  Słodycze  ' }),
    ).resolves.toEqual({ name: 'Słodycze' });
  });
});
