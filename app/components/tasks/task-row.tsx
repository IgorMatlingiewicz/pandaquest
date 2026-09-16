import { useState } from "react";
import { Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DraxHandle } from "react-native-drax";
import { grabCursorStyle } from "@/lib/web-styles";
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
import { ProgressUpdateSheet } from "./progress-update-sheet";

export type Task = {
  id: string;
  title: string;
  categoryId: string;
  completionMode: "BOOLEAN" | "PROGRESS";
  status: "ACTIVE" | "COMPLETED" | "EXPIRED";
  progressCurrent: number | null;
  progressTarget: number | null;
  subtasks?: Task[];
};

type Props = {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onUpdateProgress: (task: Task, progressCurrent: number) => Promise<void>;
};

export function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  onUpdateProgress,
}: Props) {
  const isCompleted = task.status === "COMPLETED";
  const [progressSheetOpen, setProgressSheetOpen] = useState(false);

  return (
    <>
      <HStack space="sm" className="items-center py-2">
        <DraxHandle style={grabCursorStyle}>
          <MaterialCommunityIcons name="drag-vertical" size={20} color="#999" />
        </DraxHandle>

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
          <Pressable
            onPress={() => setProgressSheetOpen(true)}
            className="flex-1"
          >
            <VStack space="xs">
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
          </Pressable>
        )}

        <Pressable onPress={() => onEdit(task)}>
          <MaterialCommunityIcons
            name="pencil-outline"
            size={16}
            color="#999"
          />
        </Pressable>
        <Pressable onPress={() => onDelete(task)}>
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={16}
            color="#999"
          />
        </Pressable>
      </HStack>

      {task.completionMode === "PROGRESS" && (
        <ProgressUpdateSheet
          isOpen={progressSheetOpen}
          onClose={() => setProgressSheetOpen(false)}
          task={task}
          onSave={(value) => onUpdateProgress(task, value)}
        />
      )}
    </>
  );
}
