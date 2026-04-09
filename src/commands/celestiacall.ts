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
    ),

  async execute(interaction) {
    const content = interaction.options.getString("message", true).trim();

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

      const channel = interaction.channel;
      if (!channel || typeof (channel as { send?: unknown }).send !== "function") {
        await interaction.editReply("I can't post a public message here.");
        return;
      }

      await (channel as { send(content: string): Promise<unknown> }).send(reply);
      await interaction.deleteReply();
    } catch (error) {
      console.error("Error in /celestiacall:", error);
      await interaction.editReply("Ara... my brain lagged. Try that again in a sec.");
    }
  },
};

export default command;
