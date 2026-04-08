import type { Message } from "discord.js";

import { badWordReplyCooldownMs } from "./config";
import type { BadWordMatch } from "./types/chat";

const badWordConfigs = [
  {
    id: "pregnant",
    patterns: [/\bpregnant\b/i, /\bpregnent\b/i, /\bpregnat\b/i, /\bpregnint\b/i],
    reactionStyle:
      "React like the caller just said something pregnancy-related. Be dramatic, nosy, playful, and teasing, like gossip just dropped in voice chat.",
  },
  {
    id: "monkey",
    patterns: [/\bmonkey\b/i, /\bmonke\b/i, /\bmonkee\b/i, /\bmunky\b/i],
    reactionStyle:
      "React like the caller just said 'monkey'. Be chaotic, unserious, and lightly mocking, like they just activated a brainless meme.",
  },
  {
    id: "onink",
    patterns: [/\bonink\b/i, /\boink\b/i, /\boi+n+k+\b/i],
    reactionStyle:
      "React like the caller just made a pig sound. Be playful, mocking, and meme-y, like you are calling out barnyard behavior.",
  },
  {
    id: "horny",
    patterns: [/\bhorny\b/i, /\bhorni\b/i, /\bh0rny\b/i, /\bdown bad\b/i],
    reactionStyle:
      "React like the caller is being shamelessly horny. Be teasing, smug, and mocking in a playful way, like you caught them lacking in public chat.",
  },
  {
    id: "sex",
    patterns: [/\bsex\b/i, /\bseggs\b/i, /\bsecks\b/i, /\bseks\b/i, /\bsexy\b/i],
    reactionStyle:
      "React like the caller said something openly sexual. Be amused, slightly judgmental, and playful, like they just turned the channel into a cursed late-night lobby.",
  },
  {
    id: "hentai",
    patterns: [/\bhentai\b/i, /\bporn\b/i, /\bporno\b/i, /\becchi\b/i],
    reactionStyle:
      "React like the caller just exposed their degenerate anime taste. Be teasing, dramatic, and smug, like you are catching them with the most obvious weeb evidence imaginable.",
  },
  {
    id: "boobs",
    patterns: [/\bboob\b/i, /\bboobs\b/i, /\bbooba\b/i, /\btits\b/i, /\btitties\b/i],
    reactionStyle:
      "React like the caller just reduced the conversation to boobs. Be playful, unimpressed, and mocking, like their brain disconnected instantly.",
  },
  {
    id: "dick",
    patterns: [/\bdick\b/i, /\bcock\b/i, /\bpenis\b/i, /\bpp\b/i],
    reactionStyle:
      "React like the caller just dropped crude NSFW guy talk. Be teasing and amused, like they have the maturity of a cursed middle-school meme compilation.",
  },
  {
    id: "cum",
    patterns: [/\bcum\b/i, /\bcumming\b/i, /\bnut\b/i, /\bnutting\b/i],
    reactionStyle:
      "React like the caller overshared something wildly horny. Be mocking and chaotic, but keep the actual reply short and non-explicit.",
  },
] as const;

const badWordCooldowns = new Map<string, number>();

export function getBadWordMatches(content: string): BadWordMatch[] {
  return badWordConfigs
    .filter((config) => config.patterns.some((pattern) => pattern.test(content)))
    .map((config) => ({
      id: config.id,
      reactionStyle: config.reactionStyle,
    }));
}

function getBadWordCooldownKey(message: Message) {
  return message.channelId;
}

export function isBadWordTriggerOnCooldown(message: Message) {
  const cooldownUntil = badWordCooldowns.get(getBadWordCooldownKey(message)) ?? 0;
  return cooldownUntil > Date.now();
}

export function startBadWordCooldown(message: Message) {
  badWordCooldowns.set(getBadWordCooldownKey(message), Date.now() + badWordReplyCooldownMs);
}
