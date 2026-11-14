import { View } from "react-native";
import { AddFriendForm } from "@/components/friends/add-friend-form";
import { CodeCard } from "@/components/friends/code-card";
import { FriendList } from "@/components/friends/friend-list";
import { VStack } from "@/components/ui/vstack";
import { useIsWide } from "@/hooks/use-is-wide";
import type { SendOutcome } from "@/hooks/use-friends";
import type { FriendFailure } from "@/lib/api-errors";
import type { Friend } from "@/types/api";

type Props = {
  code: string;
  friends: Friend[];
  sending: boolean;
  regenerating: boolean;
  onSend: (code: string) => Promise<SendOutcome | null>;
  onRegenerate: () => Promise<FriendFailure | null>;
  onOpenFriend?: (friend: Friend) => void;
};

/*
 * The Friends tab: the user's code and the field to add someone on one side,
 * the list on the other on a wide screen; one column on a narrow one, the
 * code first, as finding friends starts there.
 */
export function FriendsPanel({
  code,
  friends,
  sending,
  regenerating,
  onSend,
  onRegenerate,
  onOpenFriend,
}: Props) {
  const isWide = useIsWide();
  // flex-1 only side by side: in one column it could squeeze the height
  // on the web, as in the requests panel.
  const column = isWide ? { flex: 1 } : undefined;

  return (
    <View
      className="w-full max-w-4xl mx-auto gap-4"
      style={{
        flexDirection: isWide ? "row" : "column",
        alignItems: isWide ? "flex-start" : "stretch",
      }}
    >
      <VStack space="lg" style={column}>
        <CodeCard
          code={code}
          regenerating={regenerating}
          onRegenerate={onRegenerate}
        />
        <AddFriendForm sending={sending} onSend={onSend} />
      </VStack>
      <View style={column}>
        <FriendList friends={friends} onOpen={onOpenFriend} />
      </View>
    </View>
  );
}
