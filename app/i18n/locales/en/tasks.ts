import type pl from "../pl/tasks";

const tasks: typeof pl = {
  greeting: "Hi, {{username}}!",
  addCategory: "+ New category",
  addTask: "+ Add task",
  deleteCategoryConfirm: {
    title: "Delete category?",
    message: 'The category "{{name}}" will be deleted.',
  },
  deleteTaskConfirm: {
    title: "Delete task?",
    message: 'The task "{{title}}" will be deleted.',
  },
  deleteCategoryError: "Couldn't delete the category",
  deleteCategoryForbidden: "This category can't be deleted",
  deleteCategoryNotEmpty: "This category still has tasks. Delete them first",
  resetIn: {
    daily: "{{hours}}h {{minutes}}m",
    weekly: "{{days}}d {{hours}}h {{minutes}}m",
  },
  category: {
    newTitle: "New category",
    editTitle: "Edit category",
    nameLabel: "Name",
    namePlaceholder: "e.g. Workouts",
    iconLabel: "Icon (optional)",
    iconPlaceholder: "e.g. 💪  (default {{defaultIcon}})",
    colorLabel: "Color",
  },
  task: {
    newTitle: "New task",
    editTitle: "Edit task",
    nameLabel: "Task name",
    namePlaceholder: "e.g. Water the flowers",
    categoryLabel: "Category",
    typeLabel: "Task type",
    typeBoolean: "Simple task",
    typeProgress: "Task with progress",
    targetLabel: "Target",
    targetPlaceholder: "e.g. 10",
    currentProgressLabel: "Current progress",
    currentProgressPlaceholder: "e.g. 3",
    progressWithTarget: "Progress (target: {{target}})",
  },
};

export default tasks;
