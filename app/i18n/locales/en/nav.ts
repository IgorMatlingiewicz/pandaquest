import type pl from "../pl/nav";

const nav: typeof pl = {
  tasks: "Tasks",
  streaks: "Quit streaks",
  progress: "Progress",
  profile: "Profile",
  friends: "Friends",
  // _few and _many as in badges.descriptions: never picked in English.
  friendsWithRequests_one: "Friends, {{count}} new request",
  friendsWithRequests_few: "Friends, {{count}} new requests",
  friendsWithRequests_many: "Friends, {{count}} new requests",
  friendsWithRequests_other: "Friends, {{count}} new requests",
  menu: "Menu",
  menuWithRequests_one: "Menu, {{count}} new request",
  menuWithRequests_few: "Menu, {{count}} new requests",
  menuWithRequests_many: "Menu, {{count}} new requests",
  menuWithRequests_other: "Menu, {{count}} new requests",
  switchToEnglish: "Switch language to English",
  switchToPolish: "Switch language to Polish",
  darkTheme: "Turn on dark theme",
  lightTheme: "Turn on light theme",
};

export default nav;
