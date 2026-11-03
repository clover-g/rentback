import { playCheckA, playCheckB, playBon } from "./sound";
/** Swap the toggle "check" sound here: "A" = single clink, "B" = coin cascade. */
export const CHECK_SOUND = "B" as "A" | "B";
export const playCheck = () => (CHECK_SOUND === "A" ? playCheckA() : playCheckB());
export const playUncheck = playBon;
