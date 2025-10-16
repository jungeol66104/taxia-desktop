/*
  Warnings:

  - You are about to drop the column `transcriptFileName` on the `Call` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT,
    "userId" TEXT,
    "date" TEXT NOT NULL,
    "callerName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "recordingFileName" TEXT NOT NULL,
    "callDuration" TEXT NOT NULL,
    "transcript" TEXT,
    "fileExists" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Call_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Call_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Call" ("callDuration", "callerName", "clientId", "createdAt", "date", "id", "phoneNumber", "recordingFileName", "transcript", "updatedAt", "userId") SELECT "callDuration", "callerName", "clientId", "createdAt", "date", "id", "phoneNumber", "recordingFileName", "transcript", "updatedAt", "userId" FROM "Call";
DROP TABLE "Call";
ALTER TABLE "new_Call" RENAME TO "Call";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
