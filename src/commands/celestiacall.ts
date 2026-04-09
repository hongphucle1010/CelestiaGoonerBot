import { GuildMember, MessageFlags, SlashCommandBuilder } from "discord.js";

import { maxCallerHistoryMessages } from "../config";
import { generateDeepSeekReply } from "../deepseek";
import { appendToHistory, getHistory, getHistoryKeyFromIds, getSharedContext } from "../history";
import type { Command } from "../types/Command";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("celestiacall")
    .setDescription("Ask Celestia something; she replies in this channel for everyone to see.")
    .addStringOption((option) =>
      option.setName("message").setDescription("What you want to say to Celestia").setRequired(true).setMaxLength(2000),
    )
    .addStringOption((option) =>
      option
        .setName("reply_to")
        .setDescription("Optional message link or message ID to reply to")
        .setRequired(false),
    ),

  async execute(interaction) {
    const content = interaction.options.getString("message", true).trim();
    const replyToInput = interaction.options.getString("reply_to")?.trim() ?? null;

    if (!content) {
      await interaction.reply({
        content: "You need to give me something to work with, baka.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const scopeKey = guildId ?? "dm";
    const historyKey = getHistoryKeyFromIds(guildId, userId);
    const callerHistory = getHistory(historyKey).slice(-maxCallerHistoryMessages);
    const sharedContext = getSharedContext(scopeKey, historyKey);

    const member = interaction.member;
    const userName = member instanceof GuildMember ? member.displayName : interaction.user.username;
    const guildName = interaction.guild?.name;
    const channel = interaction.channel;

    function extractMessageIdFromInput(input: string) {
      const linkMatch = input.match(/https?:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/\d+\/\d+\/(\d+)/i);
      if (linkMatch?.[1]) {
        return linkMatch[1];
      }

      if (/^\d{15,25}$/.test(input)) {
        return input;
      }

      return null;
    }

    function extractReplyContextMessageIdFromInteraction() {
      const raw = interaction as unknown as {
        options?: {
          resolved?: {
            messages?: Record<string, unknown>;
          };
        };
      };

      const maybeMessages = raw.options?.resolved?.messages;
      if (!maybeMessages) {
        return null;
      }

      const firstMessageId = Object.keys(maybeMessages)[0];
      return firstMessageId ?? null;
    }

    try {
      const reply = await generateDeepSeekReply(content, userName, guildName, callerHistory, sharedContext, "styleRewrite");

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

      if (!channel || typeof (channel as { send?: unknown }).send !== "function") {
        await interaction.editReply("I can't post a public message here.");
        return;
      }

      let targetMessageId = replyToInput ? extractMessageIdFromInput(replyToInput) : null;
      if (replyToInput && !targetMessageId) {
        await interaction.editReply("That `reply_to` value is invalid. Use a Discord message link or message ID.");
        return;
      }

      // Best effort: some clients may provide a resolved reply context when using slash while replying.
      targetMessageId ??= extractReplyContextMessageIdFromInteraction();

      if (targetMessageId) {
        await (
          channel as {
            send(payload: {
              content: string;
              reply: { messageReference: string; failIfNotExists: boolean };
              allowedMentions: { repliedUser: boolean };
            }): Promise<unknown>;
          }
        ).send({
          content: reply,
          reply: {
            messageReference: targetMessageId,
            failIfNotExists: false,
          },
          allowedMentions: {
            repliedUser: false,
          },
        });
      } else {
        await (channel as { send(content: string): Promise<unknown> }).send(reply);
      }

      await interaction.deleteReply();
    } catch (error) {
      console.error("Error in /celestiacall:", error);
      await interaction.editReply("Ara... my brain lagged. Try that again in a sec.");
    }
  },
};

export default command;
