import { Bot } from './bot';

export class Module {}

export interface LoadableModule {
  load(bot: Bot): Module;
}
