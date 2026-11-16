import type pl from "../pl/friends";

const friends: typeof pl = {
  // _few and _many as in badges.descriptions: never picked in English.
  loadError: "Couldn't load your friends.",
  retry: "Try again",
  tabs: {
    friends: "Friends",
    requests: "Requests",
    requestsCount: "Requests ({{count}})",
  },
  code: {
    title: "Your code",
    hint: "Give it to a friend so they can invite you.",
    label: "Your friend code: {{spelled}}",
    copy: "Copy",
    copied: "Code copied",
    copyFailed: "Couldn't copy the code",
    regenerate: "Get a new one",
    regenerating: "Generating...",
    regenerated: "You have a new code",
    confirmTitle: "Get a new code?",
    confirmMessage:
      "Your current code stops working at once: whoever has it can no longer invite you with it.",
    confirmNote: "Your friends and requests stay as they are.",
  },
  add: {
    title: "Add a friend",
    label: "Friend's code",
    submit: "Send request",
    submitting: "Sending...",
    sent: "Friend request sent",
    nowFriends: "They had invited you too. You're friends now!",
  },
  profile: {
    back: "Friends",
    remove: "Remove from friends",
    removing: "Removing...",
    removeTitle: "Remove from friends: {{name}}?",
    removeMessage:
      "They disappear from your list, and you from theirs. You can invite each other again at any time.",
    removed: "Removed from friends: {{name}}",
  },
  badges: {
    back: "Profile",
    title: "Badges earned: {{count}}",
    empty: "They haven't earned any badges yet.",
  },
  list: {
    title: "Your friends ({{count}})",
    empty: "No friends yet. Give someone your code or enter a friend's code.",
    open: "{{name}}, level {{level}}. Open profile.",
  },
  requests: {
    incoming: "Received",
    outgoing: "Sent",
    incomingEmpty: "No new requests.",
    outgoingEmpty: "You're not waiting for any answer.",
    accept: "Accept",
    decline: "Decline",
    cancel: "Take back",
    acceptFrom: "Accept request from: {{name}}",
    declineFrom: "Decline request from: {{name}}",
    cancelTo: "Take back request to: {{name}}",
    waiting: "Waiting for an answer",
    accepted: "You and {{name}} are friends now",
    declinedUntil_one:
      "Request declined. You can invite them again in {{count}} day ({{date}}).",
    declinedUntil_few:
      "Request declined. You can invite them again in {{count}} days ({{date}}).",
    declinedUntil_many:
      "Request declined. You can invite them again in {{count}} days ({{date}}).",
    declinedUntil_other:
      "Request declined. You can invite them again in {{count}} days ({{date}}).",
  },
  errors: {
    INVALID_FRIEND_CODE:
      "Nobody has this code. Check that you typed it correctly.",
    CANNOT_ADD_SELF: "That's your own code.",
    ALREADY_FRIENDS: "You're already friends.",
    REQUEST_ALREADY_SENT: "Your request to them is already waiting.",
    FRIEND_REQUEST_COOLDOWN_one:
      "They declined your request. You can send a new one in {{count}} day ({{date}}).",
    FRIEND_REQUEST_COOLDOWN_few:
      "They declined your request. You can send a new one in {{count}} days ({{date}}).",
    FRIEND_REQUEST_COOLDOWN_many:
      "They declined your request. You can send a new one in {{count}} days ({{date}}).",
    FRIEND_REQUEST_COOLDOWN_other:
      "They declined your request. You can send a new one in {{count}} days ({{date}}).",
    cooldownLater: "They declined your request. You can send a new one later.",
    TOO_MANY_PENDING_REQUESTS:
      "Too many of your requests are waiting. Take one back to send a new one.",
    FRIEND_LIMIT_REACHED: "You or they already have the most friends allowed.",
    REQUEST_NOT_FOUND: "This request is no longer valid.",
    FRIEND_NOT_FOUND: "They are no longer your friend.",
    tooManyAttempts: "Too many tries. Try again in a moment.",
  },
};

export default friends;
