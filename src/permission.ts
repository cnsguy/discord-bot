import { ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import assert from 'assert';

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
  required: Permission[]
): Promise<boolean> {
  const permissions = interaction.member?.permissions;

  if (permissions === undefined) {
    await interaction.reply('This command is only available in a server.');
    return false;
  }

  assert(permissions instanceof PermissionsBitField);

  for (const permission of required) {
    if ((permissions.bitfield & permission.bits) == 0n) {
      await interaction.reply(`Missing permission: ${permission.name}`);
      return false;
    }
  }

  return true;
}
