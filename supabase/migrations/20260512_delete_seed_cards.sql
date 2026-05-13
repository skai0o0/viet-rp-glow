-- Delete all seed/dummy characters created by the UI testing seeder
DELETE FROM public.characters
WHERE name LIKE 'Seed Public Card #%';
