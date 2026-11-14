import {
  BadgeHeading,
  EarnedOn,
  TierChip,
} from "@/components/badges/badge-card";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { topFriendTier } from "@/lib/friends";
import type { FriendBadge } from "@/types/api";

/*
 * One of a friend's badges, built from the same parts as the own
 * achievements card, so the two look alike. Earned tiers only and no
 * progress: how far a friend is toward the next tier is their own business,
 * and the server does not send it. The description names the highest
 * threshold reached, not the next one.
 */
export function FriendBadgeCard({ badge }: { badge: FriendBadge }) {
  const top = topFriendTier(badge);

  return (
    <Card size="sm" className="flex-1">
      <BadgeHeading
        badgeKey={badge.key}
        topTier={top?.tier ?? null}
        threshold={top?.threshold ?? 1}
      />
      <HStack space="xs" className="flex-wrap">
        {badge.tiers.map((tier) => (
          <TierChip key={tier.tier} tier={tier} />
        ))}
      </HStack>
      {top && <EarnedOn tier={top.tier} earnedAt={top.earnedAt} />}
    </Card>
  );
}
