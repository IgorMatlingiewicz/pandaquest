import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type Ref,
  type RefObject,
} from "react";
import { Modal, View, type TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { PasswordFailure } from "@/lib/api-errors";
import {
  validatePasswordForm,
  type PasswordForm,
  type PasswordFormErrors,
} from "@/lib/profile";

// The field's ref is the TextInput itself (gluestack's input creator passes
// it on), but gluestack types it as the field's props, which have no focus().
type FieldRef = TextInput;
type GluestackFieldRef = Ref<ComponentRef<typeof InputField>>;
type Errors = PasswordFormErrors & { form?: string };

const EMPTY: PasswordForm = { current: "", next: "", repeat: "" };

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  errorKey: string | undefined;
  // For password managers: fill in the stored one, or offer a new one.
  kind: "current-password" | "new-password";
  inputRef?: RefObject<FieldRef | null>;
  // Enter moves to the next field, or sends the form from the last one.
  onSubmitEditing: () => void;
  isLast: boolean;
};

function PasswordField({
  label,
  value,
  onChangeText,
  errorKey,
  kind,
  inputRef,
  onSubmitEditing,
  isLast,
}: FieldProps) {
  const { t } = useTranslation();

  return (
    <VStack space="xs">
      <Text className="text-muted-foreground">{label}</Text>
      <Input isInvalid={errorKey !== undefined}>
        <InputField
          ref={inputRef as GluestackFieldRef}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={kind}
          textContentType={
            kind === "current-password" ? "password" : "newPassword"
          }
          returnKeyType={isLast ? "done" : "next"}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={label}
        />
      </Input>
      {errorKey && (
        <Text size="sm" className="text-destructive">
          {t(errorKey)}
        </Text>
      )}
    </VStack>
  );
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  saving: boolean;
  // Resolves to null when the password was changed.
  onSubmit: (current: string, next: string) => Promise<PasswordFailure | null>;
};

/*
 * Built like ConfirmDialog. The passwords live in this dialog's state only,
 * and are emptied whenever it opens or closes.
 */
export function ChangePasswordDialog({
  isOpen,
  onClose,
  saving,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PasswordForm>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const nextRef = useRef<FieldRef>(null);
  const repeatRef = useRef<FieldRef>(null);

  useEffect(() => {
    setForm(EMPTY);
    setErrors({});
  }, [isOpen]);

  // Typing into a field takes its message away, and the general one.
  function change(field: keyof PasswordForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      form: undefined,
    }));
  }

  async function submit() {
    const found = validatePasswordForm(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    const failure = await onSubmit(form.current, form.next);
    if (failure) setErrors({ [failure.field]: failure.key });
    else onClose();
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <Card className="p-6" style={{ width: "100%", maxWidth: 400 }}>
          <VStack space="md">
            <Heading size="lg">{t("profile.password.title")}</Heading>
            {errors.form && (
              <Text className="text-destructive">{t(errors.form)}</Text>
            )}

            <PasswordField
              label={t("profile.password.current")}
              value={form.current}
              onChangeText={(value) => change("current", value)}
              errorKey={errors.current}
              kind="current-password"
              onSubmitEditing={() => nextRef.current?.focus()}
              isLast={false}
            />
            <PasswordField
              label={t("profile.password.next")}
              value={form.next}
              onChangeText={(value) => change("next", value)}
              errorKey={errors.next}
              kind="new-password"
              inputRef={nextRef}
              onSubmitEditing={() => repeatRef.current?.focus()}
              isLast={false}
            />
            <PasswordField
              label={t("profile.password.repeat")}
              value={form.repeat}
              onChangeText={(value) => change("repeat", value)}
              errorKey={errors.repeat}
              kind="new-password"
              inputRef={repeatRef}
              onSubmitEditing={submit}
              isLast
            />

            <VStack space="sm" className="mt-2">
              <Button className="min-h-11" onPress={submit} isDisabled={saving}>
                <ButtonText>
                  {saving
                    ? t("profile.password.submitting")
                    : t("profile.password.submit")}
                </ButtonText>
              </Button>
              <Button variant="outline" className="min-h-11" onPress={onClose}>
                <ButtonText>{t("common.cancel")}</ButtonText>
              </Button>
            </VStack>
          </VStack>
        </Card>
      </View>
    </Modal>
  );
}
