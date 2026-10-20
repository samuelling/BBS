-- The board moved to the 716 (its number is 1-716-555-2455). Update the in-joke references.
UPDATE files SET content = REPLACE(content, 'the 617 scene', 'the 716 scene') WHERE filename = 'COOKBOOK.TXT' AND content IS NOT NULL;
UPDATE files SET descr = 'Lamest boards in the 716, ranked' WHERE filename = 'LAMERS.TXT' AND descr = 'Lamest boards in the 617, ranked';
