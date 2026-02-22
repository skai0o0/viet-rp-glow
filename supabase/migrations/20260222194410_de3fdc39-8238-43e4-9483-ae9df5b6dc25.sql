-- Create storage bucket for character avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-avatars', 'character-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view character avatars
CREATE POLICY "Anyone can view character avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'character-avatars');

-- Allow authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'character-avatars' AND auth.uid() IS NOT NULL);

-- Allow users to update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'character-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'character-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);