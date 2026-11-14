import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import type { Friend } from "@/types/api";

type Props = {
  friends: Friend[];
  // Opens a friend's profile; until that screen exists, rows only show.
  onOpen?: (friend: Friend) => void;
};

function FriendRow({
  friend,
  onOpen,
}: {
  friend: Friend;
  onOpen?: Props["onOpen"];
}) {
  const { t } = useTranslation();
  const content = (
    <>
      <View className="flex-1">
        <Text bold isTruncated>
          {friend.username}
        </Text>
        <Text size="sm" className="text-muted-foreground">
          {t("friends.level", { level: friend.level })}
        </Text>
      </View>
      {onOpen && (
        <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
      )}
    </>
  );
  const rowClass = "min-h-11 flex-row items-center gap-3 py-2";

  return onOpen ? (
    <Pressable
      onPress={() => onOpen(friend)}
      accessibilityRole="link"
      aria-label={t("friends.list.open", {
        name: friend.username,
        level: friend.level,
      })}
      className={rowClass}
    >
      {content}
    </Pressable>
  ) : (
    <View className={rowClass}>{content}</View>
  );
}

/*
 * The user's friends as the server sorts them (by name, the Polish way).
 * A friend is shown by name and level only: no email, no id.
 */
export function FriendList({ friends, onOpen }: Props) {
  const { t } = useTranslation();

  return (
    <Card>
      <Heading size="md">
        {t("friends.list.title", { count: friends.length })}
      </Heading>
      {friends.length === 0 ? (
        <Text className="text-muted-foreground">{t("friends.list.empty")}</Text>
      ) : (
        <View>
          {friends.map((friend, index) => (
            <View
              key={friend.friendshipId}
              className={index > 0 ? "border-t border-border" : ""}
            >
              <FriendRow friend={friend} onOpen={onOpen} />
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
