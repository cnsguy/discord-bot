import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

async function main(): Promise<void> {
  const databaseName: string | undefined = process.argv[2];

  if (databaseName === undefined) {
    throw new Error(`Usage: npm run createdb <output sqlite db file>`);
  }

  const database = await open({
    filename: databaseName,
    driver: sqlite3.Database,
  });

  for (const file of readdirSync('db')) {
    const filePath = path.join('db', file);
    const sql = readFileSync(filePath).toString();
    await database.exec(sql);
  }

  await database.close();
}

main().catch((error) => {
  if (error instanceof Error && error.stack !== undefined) {
    console.error(error.stack);
  } else {
    console.error(String(error));
  }

  process.exit(1);
});
