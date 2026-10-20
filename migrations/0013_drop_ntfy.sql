-- Phone notifications moved from ntfy to Telegram; forget the old ntfy settings (including the access token).
DELETE FROM config WHERE k LIKE 'ntfy_%';
