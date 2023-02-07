import { PermissionsBitField } from 'discord.js';
import { CommandInteraction } from './command';

export interface Permission {
  name: string;
  bits: bigint;
}

export const ManageGuild: Permission = {
  name: 'Manage guild',
  bits: PermissionsBitField.Flags.ManageGuild,
};

export async function checkInteractionPermissions(
  interaction: CommandInteraction,
  permissions: Permission[]
): Promise<boolean> {
  if (interaction.permissions === null) {
    await interaction.reply('This command is only available in a server.');
    return false;
  }

  for (const permission of permissions) {
    if ((interaction.permissions.bitfield & permission.bits) == 0n) {
      await interaction.reply(`Missing permission: ${permission.name}`);
      return false;
    }
  }

  return true;
}
