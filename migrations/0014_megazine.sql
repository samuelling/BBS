-- megaZINE submissions: outside contributors post here once the SysOp has validated their account.
INSERT INTO bases (id, side, name, sort) VALUES (6, 'main', 'megaZINE Submissions', 6);
INSERT INTO posts (base_id, from_id, from_handle, to_handle, subj, body, at) VALUES (6, NULL, 'SysOp', 'All', 'How to submit',
'megaZINE is a one-sheet paper zine with codes that lead to a website of
weird little things: apps, toys, tools, demos, music, paintings, stories.
Sam and Matt edit it. This base is how you get something in.

Post one message per piece, with this in it:

  TITLE:  what it is called
  WHAT:   two or three plain sentences about what it does
  LINK:   where people can see, play or hear it
  MADE:   by hand, by Claude, or both
  SEAL:   the name for your seal (first name or handle)

Rules:
  - It has to be yours.
  - Say honestly how it was made. That is the one rule.
  - Do not name or borrow other people''s games, films, brands or
    characters. Describe what yours does instead.

The editors read every post. If yours goes in, you get a gold megaZINE
seal with your name on it and an e-mail here on the board.',
CAST(strftime('%s','now') AS INTEGER) * 1000);
