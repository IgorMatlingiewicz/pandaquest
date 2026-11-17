import { CompletionMode, TaskType } from '../generated/prisma/client';

/** The languages a new account's example categories and tasks come in. */
export const SIGN_UP_LANGUAGES = ['pl', 'en'] as const;
export type SignUpLanguage = (typeof SIGN_UP_LANGUAGES)[number];

/** For a sign-up that names no language: as before languages existed. */
export const DEFAULT_SIGN_UP_LANGUAGE: SignUpLanguage = 'pl';

export type DefaultTaskSeed = {
  title: string;
  completionMode: CompletionMode;
  progressTarget?: number;
  progressCurrent?: number;
};

export type DefaultCategorySeed = {
  name: string;
  icon: string;
  cycleType: TaskType;
  tasks: DefaultTaskSeed[];
};

/** A text in every sign-up language. */
type Text = Record<SignUpLanguage, string>;

type TaskSeed = Omit<DefaultTaskSeed, 'title'> & { title: Text };
type CategorySeed = Omit<DefaultCategorySeed, 'name' | 'tasks'> & {
  name: Text;
  tasks: TaskSeed[];
};

/*
 * What a new account starts with: three categories that cannot be deleted
 * (they can be renamed) and a few example tasks, some with progress, so the
 * Tasks screen and the tutorial have something to show.
 *
 * One list with every text in both languages, not one list per language:
 * the languages cannot drift apart, as types, targets and progress exist
 * once. The texts are written once, at sign-up, in the app's language then;
 * after that they are the user's own data, and changing the app's language
 * does not translate them, as it does not translate anything the user typed.
 */
const SEEDS: readonly CategorySeed[] = [
  {
    name: { pl: 'Dzienne', en: 'Daily' },
    icon: '☀️',
    cycleType: TaskType.DAILY,
    tasks: [
      {
        title: { pl: 'Wyprowadź psa', en: 'Walk the dog' },
        completionMode: CompletionMode.PROGRESS,
        progressTarget: 3,
        progressCurrent: 1,
      },
      {
        title: { pl: 'Weź tabletki', en: 'Take your pills' },
        completionMode: CompletionMode.BOOLEAN,
      },
    ],
  },
  {
    name: { pl: 'Tygodniowe', en: 'Weekly' },
    icon: '📅',
    cycleType: TaskType.WEEKLY,
    tasks: [
      {
        title: { pl: 'Zrób pranie', en: 'Do the laundry' },
        completionMode: CompletionMode.BOOLEAN,
      },
      {
        title: { pl: 'Zrób zakupy', en: 'Do the shopping' },
        completionMode: CompletionMode.BOOLEAN,
      },
      {
        title: { pl: 'Idź na siłownię', en: 'Go to the gym' },
        completionMode: CompletionMode.PROGRESS,
        progressTarget: 3,
        progressCurrent: 2,
      },
    ],
  },
  {
    name: { pl: 'Życiowe', en: 'Life' },
    icon: '🎯',
    cycleType: TaskType.LIFE,
    tasks: [
      {
        title: { pl: 'Kup dom', en: 'Buy a house' },
        completionMode: CompletionMode.BOOLEAN,
      },
      {
        // No currency in English: "PLN" would read oddly to most of its
        // readers, and the amount is only an example.
        title: { pl: 'Oszczędź 100 000 PLN', en: 'Save 100,000' },
        completionMode: CompletionMode.PROGRESS,
        progressTarget: 100000,
        progressCurrent: 27000,
      },
      {
        title: {
          pl: 'Naucz się grać na skrzypcach',
          en: 'Learn to play the violin',
        },
        completionMode: CompletionMode.BOOLEAN,
      },
    ],
  },
];

/** The example categories and tasks in one language. */
export function defaultCategories(
  language: SignUpLanguage = DEFAULT_SIGN_UP_LANGUAGE,
): DefaultCategorySeed[] {
  return SEEDS.map((category) => ({
    ...category,
    name: category.name[language],
    tasks: category.tasks.map((task) => ({
      ...task,
      title: task.title[language],
    })),
  }));
}
