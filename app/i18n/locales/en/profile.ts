import type pl from "../pl/profile";

const profile: typeof pl = {
  badgeCount: "Badges: {{earned}} of {{total}}",
  joined: "On PandaQuest since: {{date}}",
  showAllBadges: "See all badges",
  loadError: "Couldn't load your profile.",
  retry: "Try again",
  showcase: {
    title: "Showcase",
    hint: "Show off up to three favorite badges.",
    emptySlot: "Empty showcase spot {{number}}. Add a badge.",
    badgeSlot:
      "Showcase spot {{number}}: {{name}}, {{tier}}. Change or remove.",
    // A friend's showcase only shows: no action to name.
    emptySlotReadOnly: "Showcase spot {{number}}: empty.",
    badgeSlotReadOnly: "Showcase spot {{number}}: {{name}}, {{tier}}.",
    saving: "Saving",
    saveError: "Couldn't save your showcase",
    invalid: "Couldn't save your showcase. Refresh the screen and try again.",
    notEarned:
      "This badge isn't among the ones you've earned. Refresh the screen and try again.",
  },
  picker: {
    title: "Choose a badge",
    empty:
      "You haven't earned any badges yet. Complete tasks and they'll show up here.",
    allShown: "All the badges you've earned are already in your showcase.",
  },
  slotMenu: {
    change: "Change",
    remove: "Remove from showcase",
  },
  settings: {
    title: "Settings",
    language: "Language",
    languages: { pl: "Polski", en: "English" },
    theme: "Theme",
    themes: { light: "Light", dark: "Dark" },
    changePassword: "Change password",
    replayTutorial: "Replay the tutorial",
  },
  password: {
    title: "Change password",
    current: "Current password",
    next: "New password",
    repeat: "Repeat new password",
    submit: "Change password",
    submitting: "Changing...",
    changed: "Your password has been changed",
    required: "Fill in this field.",
    mismatch: "The passwords don't match.",
    wrongCurrent: "Your current password is incorrect.",
    tooWeak: "The new password must be at least 8 characters long.",
    sameAsCurrent: "The new password must be different from the current one.",
  },
};

export default profile;
