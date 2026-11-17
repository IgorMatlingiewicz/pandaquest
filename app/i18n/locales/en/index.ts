// The English texts, file for file as pl/. Each section has the type of
// its Polish one, so a text missing here is a type error in that file.
import type pl from "../pl";
import common from "./common";
import nav from "./nav";
import auth from "./auth";
import tasks from "./tasks";
import streaks from "./streaks";
import xp from "./xp";
import rewards from "./rewards";
import badges from "./badges";
import progress from "./progress";
import stats from "./stats";
import achievements from "./achievements";
import profile from "./profile";
import friends from "./friends";
import tutorial from "./tutorial";
import reminders from "./reminders";

const en: typeof pl = {
  common,
  nav,
  auth,
  tasks,
  streaks,
  xp,
  rewards,
  badges,
  progress,
  stats,
  achievements,
  profile,
  friends,
  tutorial,
  reminders,
};

export default en;
