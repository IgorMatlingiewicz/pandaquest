import { Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { TaskRow, type Task } from "./task-row";

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type Props = {
  category: Category;
  tasks: Task[];
  onToggleTask: (task: Task) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
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
  onAddTask,
}: Props) {
  return (
    <Card className="mb-4 p-4">
      <HStack className="justify-between items-center mb-2">
        <Heading size="md">
          {category.icon ? `${category.icon} ` : ""}
          {category.name}
        </Heading>
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
      <VStack space="xs">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={onToggleTask}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
          />
        ))}
      </VStack>
      <Pressable onPress={onAddTask} className="mt-2 py-1">
        <Text size="sm" className="text-muted-foreground">
          + Dodaj zadanie
        </Text>
      </Pressable>
    </Card>
  );
}
