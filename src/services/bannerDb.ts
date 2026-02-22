import { supabase } from "@/integrations/supabase/client";

export type BannerData = {
  id: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  is_active: boolean;
  occasion: string;
  created_at: string;
  updated_at: string;
};

/** Fetch the currently active banner */
export async function getActiveBanner(): Promise<BannerData | null> {
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as BannerData | null;
}
