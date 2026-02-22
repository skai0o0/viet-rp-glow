
-- Create banners table for seasonal/event banners
CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  occasion TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Everyone can read active banners
CREATE POLICY "Anyone can view active banners"
ON public.banners
FOR SELECT
USING (true);

-- Only authenticated users can manage banners (you can tighten this later to admin-only)
CREATE POLICY "Authenticated users can insert banners"
ON public.banners
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update banners"
ON public.banners
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete banners"
ON public.banners
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Storage bucket for banner images
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true);

-- Anyone can view banner images
CREATE POLICY "Public read access for banner images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'banners');

-- Authenticated users can upload banner images
CREATE POLICY "Authenticated users can upload banner images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'banners' AND auth.uid() IS NOT NULL);

-- Authenticated users can update banner images
CREATE POLICY "Authenticated users can update banner images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'banners' AND auth.uid() IS NOT NULL);

-- Authenticated users can delete banner images
CREATE POLICY "Authenticated users can delete banner images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'banners' AND auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
