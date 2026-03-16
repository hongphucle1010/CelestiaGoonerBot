import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
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

const commands = new Collection<string, Command>();
const pendingReplies = new Map<string, number>();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => [".js", ".ts"].includes(path.extname(file)) && !file.endsWith(".d.ts"));
const summonPrefix = "celestia chan~";

async function generateDeepSeekReply(messageContent: string, userName: string, guildName?: string) {
  if (!deepseekApiKey) {
    return "DeepSeek is not configured yet. Add `DEEPSEEK_API_KEY` first, baka.";
  }

  if (!systemInstruction) {
    return "I cannot improvise properly yet. `DeepSeekInstruction.txt` is missing.";
  }

  const prompt = [
    "Stay fully in character and reply with one short Discord-style message.",
    "Do not explain your reasoning.",
    "Keep the response under 2 sentences.",
    "",
    "Discord context:",
    `Server: ${guildName ?? "Direct message"}`,
    `User: ${userName}`,
    `Message: ${messageContent}`,
  ].join("\n");

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

async function replyWithDeepSeek(message: Parameters<typeof client.on<Events.MessageCreate>>[1] extends (
  ...args: infer T
) => unknown
  ? T[0]
  : never, content: string) {
  try {
    const reply = await generateDeepSeekReply(
      content,
      message.member?.displayName ?? message.author.username,
      message.guild?.name,
    );
    await message.reply(reply);
  } catch (error) {
    console.error("Error while generating DeepSeek reply:", error);
    await message.reply("Ara... my brain lagged. Try that again in a sec.");
  }
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
  const hasPendingReply = (pendingReplies.get(conversationKey) ?? 0) > Date.now();
  const mentionPrefix = client.user ? new RegExp(`^<@!?${client.user.id}>\\s*,?\\s*(.+)$`, "i") : null;
  const mentionMatch = mentionPrefix?.exec(trimmedContent);
  const summonWithContentMatch = new RegExp(`^${summonPrefix}\\s*,\\s*(.+)$`, "i").exec(trimmedContent);

  if (mentionMatch?.[1]) {
    await replyWithDeepSeek(message, mentionMatch[1].trim());
    return;
  }

  if (summonWithContentMatch?.[1]) {
    await replyWithDeepSeek(message, summonWithContentMatch[1].trim());
    return;
  }

  if (normalizedContent === summonPrefix) {
    pendingReplies.set(conversationKey, Date.now() + 60_000);
    await message.reply("haiii");
    return;
  }

  if (hasPendingReply) {
    pendingReplies.delete(conversationKey);
    await replyWithDeepSeek(message, trimmedContent);
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
