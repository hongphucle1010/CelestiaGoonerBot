import { Events, type Client, type Message } from "discord.js";

import {
  getBadWordMatches,
  isBadWordTriggerOnCooldown,
  startBadWordCooldown,
} from "../badWords";
import { maxCallerHistoryMessages, summonPendingTimeoutMs, summonPrefix } from "../config";
import { generateDeepSeekReply } from "../deepseek";
import { appendToHistory, getHistory, getHistoryKey, getScopeKey, getSharedContext } from "../history";
import { parseMentionInvocation, parseSummonInvocation } from "../summon";
import type { BadWordMatch } from "../types/chat";

const pendingReplies = new Map<string, number>();

function getTypoWarning(typoedName: string | null) {
  if (!typoedName) {
    return null;
  }

  return `dumbass, it's Celestia, not ${typoedName}.`;
}

async function replyWithDeepSeek(message: Message, content: string, promptOverride?: string) {
  const scopeKey = getScopeKey(message);
  const historyKey = getHistoryKey(message);
  const callerHistory = getHistory(historyKey).slice(-maxCallerHistoryMessages);
  const sharedContext = getSharedContext(scopeKey, historyKey);

  try {
    const userName = message.member?.displayName ?? message.author.username;
    const guildName = message.guild?.name;
    const reply = await generateDeepSeekReply(
      promptOverride ?? content,
      userName,
      guildName,
      callerHistory,
      sharedContext,
    );

    appendToHistory(historyKey, {
      role: "user",
      content,
      callerName: userName,
    });
    appendToHistory(historyKey, {
      role: "assistant",
      content: reply,
      callerName: userName,
    });

    await message.reply(reply);
  } catch (error) {
    console.error("Error while generating DeepSeek reply:", error);
    await message.reply("Ara... my brain lagged. Try that again in a sec.");
  }
}

async function handleDeepSeekInvocation(message: Message, content: string, typoedName: string | null) {
  const warning = getTypoWarning(typoedName);

  if (!warning) {
    await replyWithDeepSeek(message, content);
    return;
  }

  const scopeKey = getScopeKey(message);
  const historyKey = getHistoryKey(message);
  const callerHistory = getHistory(historyKey).slice(-maxCallerHistoryMessages);
  const sharedContext = getSharedContext(scopeKey, historyKey);

  try {
    const userName = message.member?.displayName ?? message.author.username;
    const guildName = message.guild?.name;
    const reply = await generateDeepSeekReply(
      content,
      userName,
      guildName,
      callerHistory,
      sharedContext,
    );
    const finalReply = `${warning}\n${reply}`;

    appendToHistory(historyKey, {
      role: "user",
      content,
      callerName: userName,
    });
    appendToHistory(historyKey, {
      role: "assistant",
      content: finalReply,
      callerName: userName,
    });

    await message.reply(finalReply);
  } catch (error) {
    console.error("Error while generating DeepSeek reply:", error);
    await message.reply("Ara... my brain lagged. Try that again in a sec.");
  }
}

async function handleBadWordTrigger(message: Message, badWordMatches: readonly BadWordMatch[]) {
  const triggerList = badWordMatches.map((match) => match.id).join(", ");
  const styleInstructions = badWordMatches.map((match) => `- ${match.id}: ${match.reactionStyle}`).join("\n");
  const prompt = [
    `React to this Discord message because it contains these trigger words: ${triggerList}.`,
    "Keep the reply playful, short, and in character.",
    "Tease the caller lightly, but do not be genuinely hostile.",
    "Use the matching trigger style below if relevant:",
    styleInstructions,
    `Original message: ${message.content.trim()}`,
  ].join("\n");

  startBadWordCooldown(message);
  await replyWithDeepSeek(message, message.content.trim(), prompt);
}

export function registerMessageHandler(client: Client) {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) {
      return;
    }

    const trimmedContent = message.content.trim();
    const normalizedContent = trimmedContent.toLowerCase();
    const conversationKey = `${message.channelId}:${message.author.id}`;
    const historyKey = getHistoryKey(message);
    const callerName = message.member?.displayName ?? message.author.username;
    const hasPendingReply = (pendingReplies.get(conversationKey) ?? 0) > Date.now();
    const mentionInvocation = parseMentionInvocation(trimmedContent, client.user?.id);
    const summonInvocation = parseSummonInvocation(trimmedContent);
    const badWordMatches = getBadWordMatches(trimmedContent);

    if (mentionInvocation?.content) {
      await handleDeepSeekInvocation(message, mentionInvocation.content, mentionInvocation.typoedName);
      return;
    }

    if (summonInvocation?.content) {
      await handleDeepSeekInvocation(message, summonInvocation.content, summonInvocation.typoedName);
      return;
    }

    if (normalizedContent === summonPrefix || (summonInvocation && !summonInvocation.content)) {
      const warning = getTypoWarning(summonInvocation?.typoedName ?? null);
      const summonReply = warning ? `haiii\n${warning}` : "haiii";

      pendingReplies.set(conversationKey, Date.now() + summonPendingTimeoutMs);
      appendToHistory(historyKey, {
        role: "user",
        content: trimmedContent,
        callerName,
      });
      appendToHistory(historyKey, {
        role: "assistant",
        content: summonReply,
        callerName,
      });
      await message.reply(summonReply);
      return;
    }

    if (hasPendingReply) {
      pendingReplies.delete(conversationKey);
      await replyWithDeepSeek(message, trimmedContent);
      return;
    }

    if (badWordMatches.length > 0 && !isBadWordTriggerOnCooldown(message)) {
      await handleBadWordTrigger(message, badWordMatches);
    }
  });
}
