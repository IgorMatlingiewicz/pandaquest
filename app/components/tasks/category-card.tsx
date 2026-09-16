import { Pressable, View, type ListRenderItemInfo } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DraxList, DraxHandle } from "react-native-drax";
import { grabCursorStyle } from "@/lib/web-styles";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import {
  getCategoryColor,
  type CategoryColor,
} from "@/constants/category-colors";
import { type Task } from "./task-row";
import { TaskWithSubtasks } from "./task-with-subtasks";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: CategoryColor;
};

type Props = {
  category: Category;
  tasks: Task[];
  onToggleTask: (task: Task) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onUpdateTaskProgress: (task: Task, progressCurrent: number) => Promise<void>;
  onReorderTasks: (categoryId: string, tasks: Task[]) => void;
  onAddTask: () => void;
};

export function CategoryCard({
  category,
  tasks,
  onToggleTask,
  onEditCategory,
  onDeleteCategory,
  onEditTask,
  onDeleteTask,
  onUpdateTaskProgress,
  onReorderTasks,
  onAddTask,
}: Props) {
  const swatch = getCategoryColor(category.color);

  return (
    <Card className="mb-4 p-4">
      <HStack className="justify-between items-center mb-2">
        <HStack space="xs" className="items-center" style={{ flexShrink: 1 }}>
          <DraxHandle style={grabCursorStyle}>
            <MaterialCommunityIcons
              name="drag-vertical"
              size={20}
              color="#999"
            />
          </DraxHandle>
          <View
            style={{
              backgroundColor: swatch.bg,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              flexShrink: 1,
            }}
          >
            <Heading size="md" style={{ color: swatch.fg }}>
              {category.icon ? `${category.icon} ` : ""}
              {category.name}
            </Heading>
          </View>
        </HStack>
        <HStack space="sm">
          <Pressable onPress={() => onEditCategory(category)}>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={18}
              color="#999"
            />
          </Pressable>
          <Pressable onPress={() => onDeleteCategory(category)}>
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={18}
              color="#999"
            />
          </Pressable>
        </HStack>
      </HStack>

      <DraxList
        data={tasks}
        keyExtractor={(task) => task.id}
        scrollEnabled={false}
        itemDraxViewProps={{ dragHandle: true }}
        lockToMainAxis
        longPressDelay={100}
        onReorder={({ data }) => onReorderTasks(category.id, data)}
        renderItem={({ item }: ListRenderItemInfo<Task>) => (
          <TaskWithSubtasks
            task={item}
            onToggle={onToggleTask}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onUpdateProgress={onUpdateTaskProgress}
          />
        )}
      />

      <Pressable onPress={onAddTask} className="mt-2 py-1">
        <Text size="sm" className="text-muted-foreground">
          + Dodaj zadanie
        </Text>
      </Pressable>
    </Card>
  );
}
