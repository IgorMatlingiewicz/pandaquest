import type pl from "./pl";

const en: typeof pl = {
  common: {
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    loading: "Loading...",
    tryAgain: "Try again.",
    logout: "Log out",
    genericError: "Something went wrong",
  },
  nav: {
    home: "Home",
    achievements: "Achievements",
    menu: "Menu",
  },
  auth: {
    email: "Email",
    password: "Password",
    username: "Username",
    login: {
      title: "Log in",
      submit: "Log in",
      noAccount: "Don't have an account? Sign up",
      invalidCredentials: "Invalid email or password",
    },
    register: {
      title: "Sign up",
      submit: "Sign up",
      haveAccount: "Already have an account? Log in",
      failed: "Registration failed",
    },
  },
  tasks: {
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
  },
  xp: {
    level: "Level {{level}}",
    progress: "{{current}} / {{total}} XP",
    maxLevel: "Max level",
    gained: "+{{amount}} XP",
    gainedWithMultiplier: "+{{amount}} XP (×{{multiplier}})",
    levelUp: "Level up! Level {{level}}",
  },
};

export default en;
