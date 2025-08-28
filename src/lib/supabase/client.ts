// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, key);
};
