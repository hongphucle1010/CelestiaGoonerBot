import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  type Message,
  type InteractionReplyOptions,
} from "discord.js";

import type { Command } from "./types/Command";

const token = process.env.DISCORD_TOKEN;
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const deepseekModel = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
const instructionPath = path.join(process.cwd(), "DeepSeekInstruction.txt");
const systemInstruction = fs.existsSync(instructionPath)
  ? fs.readFileSync(instructionPath, "utf8").trim()
  : "";

if (!token) {
  throw new Error("Missing DISCORD_TOKEN in environment variables.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  callerName: string;
};

const commands = new Collection<string, Command>();
const pendingReplies = new Map<string, number>();
const messageHistory = new Map<string, ConversationMessage[]>();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => [".js", ".ts"].includes(path.extname(file)) && !file.endsWith(".d.ts"));
const summonPrefix = "celestia chan~";
const summonName = "celestia";
const maxCallerHistoryMessages = 30;
const maxSharedHistoryMessages = 10;
const badWordReplyCooldownMs = 600_000;
const badWordCooldowns = new Map<string, number>();

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

type InvocationMatch = {
  content: string | null;
  typoedName: string | null;
};

type BadWordMatch = {
  id: string;
  reactionStyle: string;
};

function getScopeKey(message: Message) {
  return message.guildId ?? "dm";
}

function getHistoryKey(message: Message) {
  return `${getScopeKey(message)}:${message.author.id}`;
}

function appendToHistory(historyKey: string, entry: ConversationMessage) {
  const history = messageHistory.get(historyKey) ?? [];
  history.push(entry);

  if (history.length > maxCallerHistoryMessages) {
    history.splice(0, history.length - maxCallerHistoryMessages);
  }

  messageHistory.set(historyKey, history);
}

function getHistory(historyKey: string) {
  return messageHistory.get(historyKey) ?? [];
}

function getSharedContext(scopeKey: string, activeHistoryKey: string) {
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

function getLevenshteinDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function isRecognizedSummonName(name: string) {
  return name === summonName || (name.startsWith("cel") && getLevenshteinDistance(name, summonName) <= 2);
}

function parseSummonInvocation(content: string): InvocationMatch | null {
  const normalizedContent = content.trim().toLowerCase();
  const summonMatch = /^([a-z]+)\s+chan~*(?:\s*,?\s*(.*))?$/i.exec(normalizedContent);

  if (!summonMatch) {
    return null;
  }

  const calledName = summonMatch[1];

  if (!isRecognizedSummonName(calledName)) {
    return null;
  }

  const remainingContent = summonMatch[2]?.trim() ?? "";

  return {
    content: remainingContent.length > 0 ? remainingContent : null,
    typoedName: calledName === summonName ? null : calledName,
  };
}

function parseMentionInvocation(content: string, botId?: string): InvocationMatch | null {
  if (!botId) {
    return null;
  }

  const mentionMatch = new RegExp(`^<@!?${botId}>\\s*,?\\s*(.+)$`, "i").exec(content.trim());

  if (!mentionMatch?.[1]) {
    return null;
  }

  const remainingContent = mentionMatch[1].trim();
  const summonInvocation = parseSummonInvocation(remainingContent);

  if (summonInvocation) {
    return summonInvocation;
  }

  const optionalNameMatch = /^([a-z]+)\s*,?\s+(.+)$/i.exec(remainingContent);

  if (optionalNameMatch?.[1] && optionalNameMatch[2]) {
    const calledName = optionalNameMatch[1].toLowerCase();

    if (isRecognizedSummonName(calledName)) {
      return {
        content: optionalNameMatch[2].trim(),
        typoedName: calledName === summonName ? null : calledName,
      };
    }
  }

  return {
    content: remainingContent,
    typoedName: null,
  };
}

function getBadWordMatches(content: string): BadWordMatch[] {
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

function isBadWordTriggerOnCooldown(message: Message) {
  const cooldownUntil = badWordCooldowns.get(getBadWordCooldownKey(message)) ?? 0;
  return cooldownUntil > Date.now();
}

function startBadWordCooldown(message: Message) {
  badWordCooldowns.set(getBadWordCooldownKey(message), Date.now() + badWordReplyCooldownMs);
}

function formatUserPrompt(messageContent: string, userName: string, guildName?: string) {
  return [
    "Stay fully in character and reply with one short Discord-style message.",
    "Do not explain your reasoning.",
    "Keep the response under 2 sentences.",
    "",
    "Discord context:",
    `Server: ${guildName ?? "Direct message"}`,
    `User: ${userName}`,
    `Message: ${messageContent}`,
  ].join("\n");
}

async function generateDeepSeekReply(
  messageContent: string,
  userName: string,
  guildName: string | undefined,
  callerHistory: ConversationMessage[],
  sharedContext: string | null,
) {
  if (!deepseekApiKey) {
    return "DeepSeek is not configured yet. Add `DEEPSEEK_API_KEY` first, baka.";
  }

  if (!systemInstruction) {
    return "I cannot improvise properly yet. `DeepSeekInstruction.txt` is missing.";
  }

  const prompt = formatUserPrompt(messageContent, userName, guildName);

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deepseekApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: deepseekModel,
      messages: [
        {
          role: "system",
          content: systemInstruction,
        },
        ...(sharedContext
          ? [
              {
                role: "system",
                content: sharedContext,
              },
            ]
          : []),
        ...callerHistory.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 1.1,
      max_tokens: 80,
      stream: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const reply = data.choices?.[0]?.message?.content?.trim() ?? "";

  if (!reply) {
    return "ehhh... DeepSeek just stared into the void. Try again.";
  }

  return reply;
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

function getTypoWarning(typoedName: string | null) {
  if (!typoedName) {
    return null;
  }

  return `dumbass, it's Celestia, not ${typoedName}.`;
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

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const commandModule = require(filePath) as { default?: Command };
  const command = commandModule.default;

  if (!command?.data || !command.execute) {
    console.warn(`Skipping ${file}: missing command data or execute handler.`);
    continue;
  }

  commands.set(command.data.name, command);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
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

    pendingReplies.set(conversationKey, Date.now() + 60_000);
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

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commands.get(interaction.commandName);

  if (!command) {
    const reply: InteractionReplyOptions = {
      content: "That command is not available right now.",
      flags: ["Ephemeral"],
    };

    await interaction.reply(reply);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error while running /${interaction.commandName}:`, error);

    const reply: InteractionReplyOptions = {
      content: "Something went wrong while running that command.",
      flags: ["Ephemeral"],
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
      return;
    }

    await interaction.reply(reply);
  }
});

void client.login(token);
