import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useMessageToast } from "@/hooks/use-message-toast";
import type { SendOutcome } from "@/hooks/use-friends";
import type { FriendFailure } from "@/lib/api-errors";
import { formatFriendCode, isCompleteFriendCode } from "@/lib/friends";

type Props = {
  sending: boolean;
  // Null when the call did nothing (another send still running).
  onSend: (code: string) => Promise<SendOutcome | null>;
};

/*
 * A friend's code, formatted while typed or pasted: capitals, a dash after
 * 4, nothing a code cannot have. Sending waits for all 8 characters. A
 * refusal stays under the field until the code changes; success is a toast,
 * and the field empties for the next one.
 */
export function AddFriendForm({ sending, onSend }: Props) {
  const { t } = useTranslation();
  const showMessage = useMessageToast();
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<FriendFailure | null>(null);
  const label = t("friends.add.label");
  const canSend = isCompleteFriendCode(code) && !sending;

  function change(text: string) {
    setCode(formatFriendCode(text));
    setFailure(null);
  }

  async function send() {
    if (!canSend) return;
    const outcome = await onSend(code);
    if (!outcome) return;
    if (outcome.ok) {
      showMessage(t(outcome.key));
      setCode("");
    } else {
      setFailure(outcome.failure);
    }
  }

  return (
    <Card>
      <Heading size="md">{t("friends.add.title")}</Heading>
      <VStack space="xs">
        <Text className="text-muted-foreground">{label}</Text>
        <Input isInvalid={failure !== null}>
          {/* No maxLength: it would cut a pasted code before the formatting
              takes out spaces and dashes. The formatting stops at 8. */}
          <InputField
            value={code}
            onChangeText={change}
            placeholder="ABCD-EFGH"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="send"
            onSubmitEditing={send}
            // aria-label, not accessibilityLabel: gluestack's field always
            // sends an aria-label of its own ("Input Field") unless given one.
            aria-label={label}
          />
        </Input>
        {failure && (
          <Text size="sm" className="text-destructive">
            {t(failure.key, failure.values)}
          </Text>
        )}
      </VStack>
      <Button className="min-h-11" onPress={send} isDisabled={!canSend}>
        <ButtonText>
          {sending ? t("friends.add.submitting") : t("friends.add.submit")}
        </ButtonText>
      </Button>
    </Card>
  );
}
