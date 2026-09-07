import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Witaj, {user?.username}!</Text>
      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Wyloguj się</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 20, color: "white", marginBottom: 24 },
  button: { backgroundColor: "#4A90D9", borderRadius: 8, padding: 14 },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
});
