import { PermissionsBitField } from 'discord.js';

export interface Permission {
  name: string;
  bits: bigint;
}

export const ManageGuild: Permission = {
  name: 'Manage guild',
  bits: PermissionsBitField.Flags.ManageGuild,
};
