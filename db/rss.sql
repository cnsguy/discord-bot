CREATE TABLE rss_monitor (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  channelId TEXT NOT NULL,
  link TEXT NOT NULL,
  titleRegex TEXT,
  contentRegex TEXT
);

CREATE TABLE rss_sent (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  channelId TEXT NOT NULL,
  link TEXT NOT NULL
);