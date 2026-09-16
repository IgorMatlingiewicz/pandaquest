import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { VStack } from "@/components/ui/vstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonText } from "@/components/ui/button";

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError("");
    setLoading(true);
    try {
      await register(email, username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="sm">
      <Heading size="xl" className="mb-4 text-center">
        {t("auth.register.title")}
      </Heading>

      <Input className="mb-2">
        <InputField
          placeholder={t("auth.email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Input>

      <Input className="mb-2">
        <InputField
          placeholder={t("auth.username")}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
      </Input>

      <Input className="mb-2">
        <InputField
          placeholder={t("auth.password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </Input>

      {error ? (
        <Text className="mb-2 text-center text-destructive">{error}</Text>
      ) : null}

      <Button onPress={handleRegister} isDisabled={loading} className="mt-2">
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <ButtonText>{t("auth.register.submit")}</ButtonText>
        )}
      </Button>

      <Link href="/login" className="mt-4">
        <Text className="text-center text-blue-500">
          {t("auth.register.haveAccount")}
        </Text>
      </Link>
    </VStack>
  );
}
