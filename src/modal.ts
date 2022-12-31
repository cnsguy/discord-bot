import { ModalSubmitInteraction } from 'discord.js';

export type ModalCallback = (interaction: ModalSubmitInteraction) => Promise<void>;

export class ModalEntry {
  public constructor(public readonly id: string, public readonly callback: ModalCallback) {
    this.id = id;
    this.callback = callback;
  }
}
