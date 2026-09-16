import { useState } from "react";
import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { TaskRow, type Task } from "./task-row";

type Props = {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onUpdateProgress: (task: Task, progressCurrent: number) => Promise<void>;
};

export function TaskWithSubtasks({
  task,
  onToggle,
  onEdit,
  onDelete,
  onUpdateProgress,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const subtasks = task.subtasks ?? [];
  const hasSubtasks = subtasks.length > 0;

  if (!hasSubtasks) {
    return (
      <TaskRow
        task={task}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        onUpdateProgress={onUpdateProgress}
      />
    );
  }

  return (
    <VStack space="xs">
      <HStack space="xs" className="items-center">
        <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8}>
          <MaterialCommunityIcons
            name={expanded ? "chevron-down" : "chevron-right"}
            size={20}
            color="#999"
          />
        </Pressable>
        <View className="flex-1">
          <TaskRow
            task={task}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateProgress={onUpdateProgress}
          />
        </View>
      </HStack>

      {expanded && (
        <VStack space="xs" className="ml-6">
          {subtasks.map((subtask) => (
            <TaskWithSubtasks
              key={subtask.id}
              task={subtask}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateProgress={onUpdateProgress}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
}
