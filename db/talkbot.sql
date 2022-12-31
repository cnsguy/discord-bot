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

CREATE TABLE talkbot_irc (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  contentId INTEGER NOT NULL,
  nick TEXT NOT NULL,
  ident TEXT NOT NULL,
  host TEXT NOT NULL,
  UNIQUE(contentId, nick, ident, host),
  FOREIGN KEY(contentId) REFERENCES talkbot_content(id)
);