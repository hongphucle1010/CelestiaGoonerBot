import type { Message } from "discord.js";

import { maxCallerHistoryMessages, maxSharedHistoryMessages } from "./config";
import type { ConversationMessage } from "./types/chat";

const messageHistory = new Map<string, ConversationMessage[]>();

export function getScopeKeyFromIds(guildId: string | null) {
  return guildId ?? "dm";
}

export function getHistoryKeyFromIds(guildId: string | null, userId: string) {
  return `${getScopeKeyFromIds(guildId)}:${userId}`;
}

export function getScopeKey(message: Message) {
  return getScopeKeyFromIds(message.guildId);
}

export function getHistoryKey(message: Message) {
  return getHistoryKeyFromIds(message.guildId, message.author.id);
}

export function appendToHistory(historyKey: string, entry: ConversationMessage) {
  const history = messageHistory.get(historyKey) ?? [];
  history.push(entry);

  if (history.length > maxCallerHistoryMessages) {
    history.splice(0, history.length - maxCallerHistoryMessages);
  }

  messageHistory.set(historyKey, history);
}

export function getHistory(historyKey: string) {
  return messageHistory.get(historyKey) ?? [];
}

export function getSharedContext(scopeKey: string, activeHistoryKey: string) {
  const sharedTranscripts = Array.from(messageHistory.entries())
    .filter(([historyKey, history]) => {
      return historyKey.startsWith(`${scopeKey}:`) && historyKey !== activeHistoryKey && history.length > 0;
    })
    .map(([, history]) => {
      const recentHistory = history.slice(-maxSharedHistoryMessages);
      const callerName = recentHistory[recentHistory.length - 1]?.callerName ?? "Unknown caller";
      const transcript = recentHistory
        .map((entry) => {
          const speaker = entry.role === "assistant" ? "CelestiaGooner" : callerName;
          return `${speaker}: ${entry.content}`;
        })
        .join("\n");

      return `Caller ${callerName} recent messages:\n${transcript}`;
    });

  if (sharedTranscripts.length === 0) {
    return null;
  }

  return [
    "Shared background from other callers in this server. Use it only as light context.",
    "Do not confuse their identity with the current caller.",
    ...sharedTranscripts,
  ].join("\n\n");
}
