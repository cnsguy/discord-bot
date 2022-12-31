import { ChatInputCommandInteraction, GuildMember, PermissionsBitField } from 'discord.js';

export interface Permission {
  name: string;
  bits: bigint;
}

export const ManageGuild: Permission = {
  name: 'Manage guild',
  bits: PermissionsBitField.Flags.ManageGuild,
};

export async function checkInteractionPermissions(
  interaction: ChatInputCommandInteraction,
  permissions: Permission[]
): Promise<boolean> {
  if (!(interaction.member instanceof GuildMember)) {
    await interaction.reply("You're not a guild member.");
    return false;
  }

  for (const permission of permissions) {
    if ((interaction.member.permissions.bitfield & permission.bits) == 0n) {
      await interaction.reply(`Missing permission: ${permission.name}`);
      return false;
    }
  }

  return true;
}
