import { SlashCommandBuilder } from "discord.js";

import type { Command } from "../types/Command";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Show information about this server."),

  async execute(interaction) {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: ["Ephemeral"],
      });
      return;
    }

    await interaction.reply(
      `This server is **${guild.name}** and has **${guild.memberCount}** members.`,
    );
  },
};

export default command;
