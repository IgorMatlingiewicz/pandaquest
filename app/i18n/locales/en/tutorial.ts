import type pl from "../pl/tutorial";

const tutorial: typeof pl = {
  counter: "{{step}}/{{total}}",
  heading: "Step {{step}} of {{total}}: {{title}}",
  back: "Back",
  next: "Next",
  finish: "Finish",
  retry: "Try again",
  saving: "Saving...",
  close: "Turn off the tutorial",
  saveError: "Couldn't save. Please try again.",
  menuHint: "You'll find the screens in the ☰ menu in the top left corner.",
  steps: {
    welcome: {
      title: "Welcome to PandaQuest!",
      body: "This app turns everyday chores into a game: finished tasks earn you XP, levels and badges. Let me show you around quickly.",
    },
    tasks: {
      title: "Tasks",
      body: "This is where you plan your day. Tasks live in categories. Add a category with “+ New category” at the bottom of the list, and a task with “+ Add task” under a category. Edit with the pencil on the right, delete with the bin. Tick the box when a task is done. Change the order by dragging the handle on the left.",
    },
    xp: {
      title: "XP and levels",
      body: "Finished tasks give you XP. The bar at the top of the screen shows your level and how far you are from the next one. Daily and weekly tasks reset on their own, and the timer next to the category name shows how much time is left.",
    },
    streaks: {
      title: "Quit streaks",
      body: "A quit streak counts the time without something you're giving up, like sweets. Every full day earns XP, and each milestone earns a badge. If you slip, the timer starts over, but your record and badges stay. You can have up to 5 goals. Your goals are private: your friends can't see them.",
    },
    stats: {
      title: "Statistics",
      body: "The activity calendar shows how many tasks you do each day, and a dot marks a full day. The tiles sum up full days, your streak, XP and tasks done this month, and the chart shows your XP over the last 8 weeks.",
    },
    achievements: {
      title: "Achievements",
      body: "Here are your badges. Many have several tiers, from Bronze to Diamond. Each one shows what it takes, how far you've got and how much XP the next tier is worth.",
    },
    friends: {
      title: "Friends",
      body: "This is your friend code. Give it to someone and they'll enter it in the “Friend's code” field. Accept invitations in the “Requests” tab. Friends see your name, level, showcase, badge count, join date and the badges you've earned. Nothing else.",
    },
    profile: {
      title: "Profile",
      body: "Pick up to three badges for your showcase; your friends will see them. In the settings you can change the language, theme and password, and “Replay the tutorial” shows you this guide again.",
    },
    honesty: {
      title: "The honesty rule",
      body: "The app has no way of checking whether a task was really done. You decide what you tick off, and XP and badges only mean something when they're honest. You track and tick off your progress for yourself, not for the points.",
    },
  },
  closeConfirm: {
    title: "Turn off the tutorial?",
    message: "You can replay it any time in the app settings.",
    confirm: "Turn off",
    cancel: "Back to the tutorial",
  },
  farewell: {
    title: "Enjoy the app!",
    message: "You can replay the tutorial in your Profile, under Settings.",
    action: "Let's go",
  },
};

export default tutorial;
