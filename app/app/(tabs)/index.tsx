import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HomeScreen() {
  const [status, setStatus] = useState("Ładowanie...");

  useEffect(() => {
    fetch("http://192.168.0.152:3000/health")
      .then((response) => response.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("Błąd połączenia z backendem"));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Status backendu: {status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 20, color: "white" },
});
