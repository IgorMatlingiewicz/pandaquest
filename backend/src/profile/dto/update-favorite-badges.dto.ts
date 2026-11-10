import { ArrayMaxSize, ArrayMinSize, IsArray } from 'class-validator';
import { FAVORITE_SLOTS } from '../profile.config';

export class UpdateFavoriteBadgesDto {
  // Only the length is checked here. Each slot is null or a badge, which
  // class-validator handles poorly without `transform`, so parseFavoriteSlots
  // checks the slots themselves.
  @IsArray()
  @ArrayMinSize(FAVORITE_SLOTS)
  @ArrayMaxSize(FAVORITE_SLOTS)
  slots!: unknown[];
}
