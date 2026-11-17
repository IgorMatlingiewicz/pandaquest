import type pl from "../pl/reminders";

// _few and _many as in badges.descriptions: never picked in English. A
// "5-day streak" takes no plural: the number works as an adjective.
const reminders: typeof pl = {
  title: "Reminder",
  close: "Close",
  goToTasks: "Go to tasks",
  goToFriends: "Go to Friends",
  daily_one:
    "The day is coming to an end and you still have {{count}} daily task to do. Time runs out at midnight.",
  daily_few:
    "The day is coming to an end and you still have {{count}} daily tasks to do. Time runs out at midnight.",
  daily_many:
    "The day is coming to an end and you still have {{count}} daily tasks to do. Time runs out at midnight.",
  daily_other:
    "The day is coming to an end and you still have {{count}} daily tasks to do. Time runs out at midnight.",
  weekly:
    "This is the last day of the week: you have 24 hours at most for your weekly tasks.",
  streakDays_one: "Heads up: your {{count}}-day streak is at risk!",
  streakDays_few: "Heads up: your {{count}}-day streak is at risk!",
  streakDays_many: "Heads up: your {{count}}-day streak is at risk!",
  streakDays_other: "Heads up: your {{count}}-day streak is at risk!",
  streakWeeks_one: "Heads up: your {{count}}-week streak is at risk!",
  streakWeeks_few: "Heads up: your {{count}}-week streak is at risk!",
  streakWeeks_many: "Heads up: your {{count}}-week streak is at risk!",
  streakWeeks_other: "Heads up: your {{count}}-week streak is at risk!",
  friends_one: "You have {{count}} new friend request. Check the Friends tab.",
  friends_few: "You have {{count}} new friend requests. Check the Friends tab.",
  friends_many:
    "You have {{count}} new friend requests. Check the Friends tab.",
  friends_other:
    "You have {{count}} new friend requests. Check the Friends tab.",
};

export default reminders;
