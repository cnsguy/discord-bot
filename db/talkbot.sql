CREATE TABLE talkbot_content (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  quote TEXT NOT NULL,
  UNIQUE(quote)
);

CREATE TABLE talkbot_discord (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  contentId INTEGER NOT NULL,
  userId TEXT NOT NULL,
  UNIQUE(contentId, userId),
  FOREIGN KEY(contentId) REFERENCES talkbot_content(id)
);