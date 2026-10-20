-- One-time reset (Oct 2026): blank slate for accounts and everything callers created.
-- Board settings, areas, bases, built-in text files and the welcome posts stay.
-- The next account created becomes the SysOp again.
DELETE FROM users;
DELETE FROM callers;
DELETE FROM mail;
DELETE FROM oneliners;
DELETE FROM apps;
DELETE FROM pages;
DELETE FROM chat;
DELETE FROM tickets;
DELETE FROM posts WHERE from_id IS NOT NULL;
DELETE FROM files WHERE content IS NULL;
UPDATE line SET token = NULL, user_id = NULL, handle = NULL, activity = NULL, beat = 0, backdoor = 0, elite_ok = 0, room = NULL;
