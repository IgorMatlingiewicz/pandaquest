import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateFavoriteBadgesDto } from './update-favorite-badges.dto';

// The pipe configured as in main.ts, so these tests see what a request sees.
const validate = (body: unknown) =>
  new ValidationPipe().transform(body, {
    type: 'body',
    metatype: UpdateFavoriteBadgesDto,
  });

describe('UpdateFavoriteBadgesDto', () => {
  it('lets three slots through, empty or not, for the service to check', async () => {
    const body = {
      slots: [null, { badgeKey: 'first_day', tier: 'BRONZE' }, null],
    };

    await expect(validate(body)).resolves.toEqual(body);
  });

  it.each([
    ['two slots', { slots: [null, null] }],
    ['four slots', { slots: [null, null, null, null] }],
    ['no slots field', {}],
    ['slots that are not a list', { slots: 'first_day' }],
  ])('refuses %s', async (_, body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
