import { Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckboxLabel,
} from "@/components/ui/checkbox";
import { CheckIcon } from "@/components/ui/icon";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  completionMode: "BOOLEAN" | "PROGRESS";
  status: "ACTIVE" | "COMPLETED" | "EXPIRED";
  progressCurrent: number | null;
  progressTarget: number | null;
};

type Props = {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

export function TaskRow({ task, onToggle, onEdit, onDelete }: Props) {
  const isCompleted = task.status === "COMPLETED";

  return (
    <HStack space="sm" className="items-center py-2">
      <MaterialCommunityIcons name="drag-vertical" size={20} color="#999" />

      {task.completionMode === "BOOLEAN" ? (
        <Checkbox
          value={task.id}
          isChecked={isCompleted}
          onChange={() => onToggle(task)}
          className="flex-1"
        >
          <CheckboxIndicator>
            <CheckboxIcon as={CheckIcon} />
          </CheckboxIndicator>
          <CheckboxLabel>{task.title}</CheckboxLabel>
        </Checkbox>
      ) : (
        <VStack className="flex-1" space="xs">
          <HStack className="justify-between">
            <Text>{task.title}</Text>
            <Text size="sm" className="text-muted-foreground">
              {task.progressCurrent}/{task.progressTarget}
            </Text>
          </HStack>
          <Progress
            value={
              task.progressTarget
                ? (task.progressCurrent! / task.progressTarget) * 100
                : 0
            }
          >
            <ProgressFilledTrack />
          </Progress>
        </VStack>
      )}

      <Pressable onPress={() => onEdit(task)}>
        <MaterialCommunityIcons name="pencil-outline" size={16} color="#999" />
      </Pressable>
      <Pressable onPress={() => onDelete(task)}>
        <MaterialCommunityIcons
          name="trash-can-outline"
          size={16}
          color="#999"
        />
      </Pressable>
    </HStack>
  );
}
