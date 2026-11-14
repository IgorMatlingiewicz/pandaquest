import { Stack } from "expo-router";

// The friends tab keeps its own stack: the list, then a friend's profile and
// their badges on top of it, while the top bar stays. No headers: the app has
// none anywhere, and the screens show their own way back.
export default function FriendsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
