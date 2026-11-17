import { CompletionMode, TaskType } from '../generated/prisma/client';
import {
  DEFAULT_SIGN_UP_LANGUAGE,
  defaultCategories,
  SIGN_UP_LANGUAGES,
} from './default-categories';

const names = (language?: 'pl' | 'en') =>
  defaultCategories(language).map((category) => ({
    name: category.name,
    tasks: category.tasks.map((task) => task.title),
  }));

// Everything but the words: the same in every language.
const shape = (language: 'pl' | 'en') =>
  defaultCategories(language).map(({ icon, cycleType, tasks }) => ({
    icon,
    cycleType,
    tasks: tasks.map(({ completionMode, progressTarget, progressCurrent }) => ({
      completionMode,
      progressTarget,
      progressCurrent,
    })),
  }));

describe('defaultCategories', () => {
  it('writes the examples in Polish', () => {
    expect(names('pl')).toEqual([
      { name: 'Dzienne', tasks: ['Wyprowadź psa', 'Weź tabletki'] },
      {
        name: 'Tygodniowe',
        tasks: ['Zrób pranie', 'Zrób zakupy', 'Idź na siłownię'],
      },
      {
        name: 'Życiowe',
        tasks: [
          'Kup dom',
          'Oszczędź 100 000 PLN',
          'Naucz się grać na skrzypcach',
        ],
      },
    ]);
  });

  it('writes the examples in English', () => {
    expect(names('en')).toEqual([
      { name: 'Daily', tasks: ['Walk the dog', 'Take your pills'] },
      {
        name: 'Weekly',
        tasks: ['Do the laundry', 'Do the shopping', 'Go to the gym'],
      },
      {
        name: 'Life',
        tasks: ['Buy a house', 'Save 100,000', 'Learn to play the violin'],
      },
    ]);
  });

  it('gives Polish to a sign-up that names no language, as before', () => {
    expect(DEFAULT_SIGN_UP_LANGUAGE).toBe('pl');
    expect(names()).toEqual(names('pl'));
  });

  it('differs between the languages only in the words', () => {
    expect(shape('en')).toEqual(shape('pl'));
    expect(shape('pl')).toEqual([
      {
        icon: '☀️',
        cycleType: TaskType.DAILY,
        tasks: [
          {
            completionMode: CompletionMode.PROGRESS,
            progressTarget: 3,
            progressCurrent: 1,
          },
          { completionMode: CompletionMode.BOOLEAN },
        ],
      },
      {
        icon: '📅',
        cycleType: TaskType.WEEKLY,
        tasks: [
          { completionMode: CompletionMode.BOOLEAN },
          { completionMode: CompletionMode.BOOLEAN },
          {
            completionMode: CompletionMode.PROGRESS,
            progressTarget: 3,
            progressCurrent: 2,
          },
        ],
      },
      {
        icon: '🎯',
        cycleType: TaskType.LIFE,
        tasks: [
          { completionMode: CompletionMode.BOOLEAN },
          {
            completionMode: CompletionMode.PROGRESS,
            progressTarget: 100000,
            progressCurrent: 27000,
          },
          { completionMode: CompletionMode.BOOLEAN },
        ],
      },
    ]);
  });

  it('are the languages the app has', () => {
    expect(SIGN_UP_LANGUAGES).toEqual(['pl', 'en']);
  });

  it('hands out a fresh copy each time', () => {
    const first = defaultCategories('pl');
    first[0].name = 'changed';

    expect(defaultCategories('pl')[0].name).toBe('Dzienne');
  });
});
