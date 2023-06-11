import { Module } from '../module';
import { Bot } from '../bot';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

interface TauriJSONStatusEntry {
  readonly shortname: string;
  readonly hidden: string;
  readonly status: string;
  readonly online: number;
  readonly horde: number;
  readonly alliance: number;
  readonly neutral: number;
}

export class TauriModule extends Module {
  private constructor(bot: Bot) {
    super();

    const tauriStatusCommand = new SlashCommandBuilder()
      .setName('tauri')
      .setDescription('Display Tauri server status')
      .toJSON();

    bot.registerSlashCommand(tauriStatusCommand, (interaction) => this.tauriCommand(interaction));
  }

  public static load(bot: Bot): TauriModule {
    return new TauriModule(bot);
  }

  private async tauriCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const response = await fetch('https://tauriwow.com/files/serverstatus_json.php');

    if (response.status != 200) {
      await interaction.reply(`Failed to get search results; server returned error code ${response.status}`);
      return;
    }

    const json = JSON.parse(await response.text()) as TauriJSONStatusEntry[];
    const embed = new EmbedBuilder();
    const filter = new Set(['Tauri', 'WoD', 'Evermoon', 'Mrgl', 'Crystalsong']);

    for (const realm of json) {
      if (realm.hidden === 'true' || !filter.has(realm.shortname)) {
        continue;
      }

      const realmStatus = `Total: ${realm.online} Horde: ${realm.horde} Alliance: ${realm.alliance} Status: ${realm.status}`;
      embed.addFields({ name: realm.shortname, value: realmStatus });
    }

    await interaction.reply({ embeds: [embed] });
  }
}
