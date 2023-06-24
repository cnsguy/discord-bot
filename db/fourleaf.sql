CREATE TABLE fourleaf_monitor (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  channelId TEXT NOT NULL,
  board TEXT NOT NULL,
  messageRegex TEXT,
  messageRegexIgnoreCase BOOLEAN NOT NULL,
  nameRegex TEXT,
  nameRegexIgnoreCase BOOLEAN NOT NULL,
  tripcodeRegex TEXT,
  tripcodeRegexIgnoreCase BOOLEAN NOT NULL,
  filenameRegex TEXT,
  filenameRegexIgnoreCase BOOLEAN NOT NULL,
  threadSubjectRegex TEXT,
  threadSubjectRegexIgnoreCase BOOLEAN NOT NULL,
  minReplies INTEGER,
  isOp BOOLEAN,
  extraText TEXT,
);

CREATE TABLE fourleaf_sent (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  channelId TEXT NOT NULL,
  postNumber INTEGER NOT NULL
);