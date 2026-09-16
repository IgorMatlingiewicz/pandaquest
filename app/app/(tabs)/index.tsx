import { useEffect, useState, useCallback } from "react";
import { RefreshControl, Pressable, View } from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { DraxList } from "react-native-drax";
import { useAuth } from "@/context/AuthContext";
import { CategoryCard } from "@/components/tasks/category-card";
import {
  CategorySheet,
  type CategoryFormValues,
} from "@/components/tasks/category-sheet";
import { TaskSheet, type TaskFormValues } from "@/components/tasks/task-sheet";
import { type Task } from "@/components/tasks/task-row";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { API_URL } from "@/constants/api";
import { type CategoryColor } from "@/constants/category-colors";
import { alertMessage, confirmAsync } from "@/lib/confirm";
import { reorderItems } from "@/lib/reorder";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: CategoryColor;
};

export default function HomeScreen() {
  const { token, user, logout } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(
    undefined,
  );
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [taskCategoryId, setTaskCategoryId] = useState<string | undefined>(
    undefined,
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    const [categoriesRes, tasksRes] = await Promise.all([
      fetch(`${API_URL}/categories`, { headers }),
      fetch(`${API_URL}/tasks`, { headers }),
    ]);

    setCategories(await categoriesRes.json());
    setTasks(await tasksRes.json());
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleToggleTask(task: Task) {
    const newStatus = task.status === "COMPLETED" ? "ACTIVE" : "COMPLETED";

    await fetch(`${API_URL}/tasks/${task.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });

    await loadData();
  }

  function openNewCategorySheet() {
    setEditingCategory(undefined);
    setSheetOpen(true);
  }

  function openEditCategorySheet(category: Category) {
    setEditingCategory(category);
    setSheetOpen(true);
  }

  async function handleSaveCategory(values: CategoryFormValues) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    if (editingCategory) {
      await fetch(`${API_URL}/categories/${editingCategory.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(values),
      });
    } else {
      await fetch(`${API_URL}/categories`, {
        method: "POST",
        headers,
        body: JSON.stringify(values),
      });
    }

    await loadData();
  }

  async function handleDeleteCategory(category: Category) {
    const ok = await confirmAsync(
      "Usunąć kategorię?",
      `Kategoria "${category.name}" zostanie usunięta.`,
    );
    if (!ok) return;

    const response = await fetch(`${API_URL}/categories/${category.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      alertMessage(
        "Nie udało się usunąć kategorii",
        err?.message ?? "Spróbuj ponownie.",
      );
      return;
    }

    await loadData();
  }

  async function handleDeleteTask(task: Task) {
    const ok = await confirmAsync(
      "Usunąć zadanie?",
      `Zadanie "${task.title}" zostanie usunięte.`,
    );
    if (!ok) return;

    await fetch(`${API_URL}/tasks/${task.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    await loadData();
  }

  async function handleUpdateProgress(task: Task, progressCurrent: number) {
    await fetch(`${API_URL}/tasks/${task.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ progressCurrent }),
    });

    await loadData();
  }

  async function handleReorderCategories(newOrder: Category[]) {
    setCategories(newOrder);
    if (!token) return;

    await reorderItems(
      "categories",
      token,
      newOrder.map((category, index) => ({ id: category.id, order: index })),
    );
  }

  async function handleReorderTasks(categoryId: string, newOrder: Task[]) {
    setTasks((prev) => [
      ...prev.filter((t) => t.categoryId !== categoryId),
      ...newOrder,
    ]);
    if (!token) return;

    await reorderItems(
      "tasks",
      token,
      newOrder.map((task, index) => ({ id: task.id, order: index })),
    );
  }

  function openNewTaskSheet(categoryId: string) {
    setEditingTask(undefined);
    setTaskCategoryId(categoryId);
    setTaskSheetOpen(true);
  }

  function openEditTaskSheet(task: Task) {
    setEditingTask(task);
    setTaskCategoryId(undefined);
    setTaskSheetOpen(true);
  }

  async function handleSaveTask(values: TaskFormValues) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    if (editingTask) {
      await fetch(`${API_URL}/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          title: values.title,
          categoryId: values.categoryId,
          ...(values.progressCurrent !== undefined
            ? { progressCurrent: values.progressCurrent }
            : {}),
        }),
      });
    } else {
      await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: values.title,
          categoryId: values.categoryId,
          completionMode: values.completionMode,
          progressTarget: values.progressTarget,
        }),
      });
    }

    await loadData();
  }

  if (loading) {
    return (
      <VStack className="flex-1 items-center justify-center">
        <Text>Ładowanie...</Text>
      </VStack>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <DraxList
        data={categories}
        keyExtractor={(category) => category.id}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        itemDraxViewProps={{ dragHandle: true }}
        lockToMainAxis
        longPressDelay={100}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={loadData} />
        }
        onReorder={({ data }) => handleReorderCategories(data)}
        ListHeaderComponent={
          <VStack className="w-full max-w-2xl mx-auto">
            <Text size="lg" className="mb-4">
              Cześć, {user?.username}!
            </Text>
          </VStack>
        }
        ListFooterComponent={
          <VStack className="w-full max-w-2xl mx-auto">
            <Pressable
              onPress={openNewCategorySheet}
              className="items-center py-3 border border-dashed border-border rounded-xl mb-8"
            >
              <Text className="text-muted-foreground">+ Nowa kategoria</Text>
            </Pressable>
          </VStack>
        }
        renderItem={({ item }: ListRenderItemInfo<Category>) => (
          <View className="w-full max-w-2xl mx-auto">
            <CategoryCard
              category={item}
              tasks={tasks.filter((t) => t.categoryId === item.id)}
              onToggleTask={handleToggleTask}
              onEditCategory={openEditCategorySheet}
              onDeleteCategory={handleDeleteCategory}
              onEditTask={openEditTaskSheet}
              onDeleteTask={handleDeleteTask}
              onUpdateTaskProgress={handleUpdateProgress}
              onReorderTasks={handleReorderTasks}
              onAddTask={() => openNewTaskSheet(item.id)}
            />
          </View>
        )}
      />

      <CategorySheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialValues={
          editingCategory
            ? {
                name: editingCategory.name,
                icon: editingCategory.icon ?? "",
                color: editingCategory.color,
              }
            : undefined
        }
        onSave={handleSaveCategory}
      />

      <TaskSheet
        isOpen={taskSheetOpen}
        onClose={() => setTaskSheetOpen(false)}
        categories={categories}
        isEditing={!!editingTask}
        initialValues={
          editingTask
            ? {
                title: editingTask.title,
                categoryId: editingTask.categoryId,
                completionMode: editingTask.completionMode,
                progressCurrent: editingTask.progressCurrent ?? undefined,
              }
            : taskCategoryId
              ? { title: "", categoryId: taskCategoryId }
              : undefined
        }
        onSave={handleSaveTask}
      />
    </View>
  );
}
