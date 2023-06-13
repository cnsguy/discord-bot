import { readEnvOrThrow } from './util';
import { Bot } from './bot';
import { config } from 'dotenv';

async function main(): Promise<void> {
  config();
  const token = readEnvOrThrow('TOKEN');
  const modules = readEnvOrThrow('MODULES').split(' ');
  const database = readEnvOrThrow('DATABASE');
  const adminUserId = process.env['ADMIN_USER_ID'];
  const bot = await Bot.new(token, adminUserId, modules, database);
  await bot.run();
}

main().catch((error) => {
  if (error instanceof Error && error.stack !== undefined) {
    console.error(error.stack);
  } else {
    console.error(String(error));
  }

  process.exit(1);
});
