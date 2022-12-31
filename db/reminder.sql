CREATE TABLE reminder (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  messageContent TEXT NOT NULL,
  guildId TEXT,
  channelId TEXT NOT NULL,
  senderId TEXT NOT NULL,
  nextDate DATETIME NOT NULL,
  repeatInterval DATETIME
);