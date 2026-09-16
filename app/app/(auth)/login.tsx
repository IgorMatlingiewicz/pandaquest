import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { VStack } from "@/components/ui/vstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonText } from "@/components/ui/button";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coś poszło nie tak");
    } finally {
      setLoading(false);
    }
  }

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="sm">
      <Heading size="xl" className="mb-4 text-center">
        Logowanie
      </Heading>

      <Input className="mb-2">
        <InputField
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Input>

      <Input className="mb-2">
        <InputField
          placeholder="Hasło"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </Input>

      {error ? (
        <Text className="mb-2 text-center text-destructive">{error}</Text>
      ) : null}

      <Button onPress={handleLogin} isDisabled={loading} className="mt-2">
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <ButtonText>Zaloguj się</ButtonText>
        )}
      </Button>

      <Link href="/register" className="mt-4">
        <Text className="text-center text-blue-500">
          Nie masz konta? Zarejestruj się
        </Text>
      </Link>
    </VStack>
  );
}
