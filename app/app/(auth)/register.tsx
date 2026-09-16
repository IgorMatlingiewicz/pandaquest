import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { VStack } from "@/components/ui/vstack";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Input, InputField } from "@/components/ui/input";
import { Button, ButtonText } from "@/components/ui/button";

export default function RegisterScreen() {
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
      setError(e instanceof Error ? e.message : "Coś poszło nie tak");
    } finally {
      setLoading(false);
    }
  }

  return (
    <VStack className="flex-1 justify-center bg-background p-6" space="sm">
      <Heading size="xl" className="mb-4 text-center">
        Rejestracja
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
          placeholder="Nazwa użytkownika"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
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

      <Button onPress={handleRegister} isDisabled={loading} className="mt-2">
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <ButtonText>Zarejestruj się</ButtonText>
        )}
      </Button>

      <Link href="/login" className="mt-4">
        <Text className="text-center text-blue-500">
          Masz już konto? Zaloguj się
        </Text>
      </Link>
    </VStack>
  );
}
