CREATE TABLE fourleaf_monitor (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  channelId TEXT NOT NULL,
  board TEXT NOT NULL,
  messageRegex TEXT,
  nameRegex TEXT,
  tripcodeRegex TEXT,
  filenameRegex TEXT,
  threadSubjectRegex TEXT,
  minReplies INTEGER,
  isOp BOOLEAN
);

CREATE TABLE fourleaf_sent (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  channelId TEXT NOT NULL,
  postNumber INTEGER NOT NULL
);