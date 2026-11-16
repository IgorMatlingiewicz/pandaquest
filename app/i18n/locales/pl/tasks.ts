const tasks = {
  greeting: "Cześć, {{username}}!",
  addCategory: "+ Nowa kategoria",
  addTask: "+ Dodaj zadanie",
  deleteCategoryConfirm: {
    title: "Usunąć kategorię?",
    message: 'Kategoria "{{name}}" zostanie usunięta.',
  },
  deleteTaskConfirm: {
    title: "Usunąć zadanie?",
    message: 'Zadanie "{{title}}" zostanie usunięte.',
  },
  deleteCategoryError: "Nie udało się usunąć kategorii",
  deleteCategoryForbidden: "Tej kategorii nie można usunąć",
  deleteCategoryNotEmpty: "Ta kategoria zawiera zadania. Usuń je najpierw",
  resetIn: {
    daily: "{{hours}} godz. {{minutes}} min",
    weekly: "{{days}} d {{hours}} godz. {{minutes}} min",
  },
  category: {
    newTitle: "Nowa kategoria",
    editTitle: "Edytuj kategorię",
    nameLabel: "Nazwa",
    namePlaceholder: "np. Treningi",
    iconLabel: "Ikona (opcjonalnie)",
    iconPlaceholder: "np. 💪  (domyślnie {{defaultIcon}})",
    colorLabel: "Kolor",
  },
  task: {
    newTitle: "Nowe zadanie",
    editTitle: "Edytuj zadanie",
    nameLabel: "Nazwa zadania",
    namePlaceholder: "np. Podlej kwiaty",
    categoryLabel: "Kategoria",
    typeLabel: "Typ zadania",
    typeBoolean: "Zwykłe zadanie",
    typeProgress: "Zadanie z postępem",
    targetLabel: "Cel",
    targetPlaceholder: "np. 10",
    currentProgressLabel: "Aktualny postęp",
    currentProgressPlaceholder: "np. 3",
    progressWithTarget: "Postęp (cel: {{target}})",
  },
};

export default tasks;
