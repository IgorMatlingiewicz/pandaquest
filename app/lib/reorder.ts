import { API_URL } from "@/constants/api";

export async function reorderItems(
  kind: "categories" | "tasks",
  token: string,
  items: { id: string; order: number }[],
) {
  await fetch(`${API_URL}/${kind}/reorder`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items }),
  });
}
