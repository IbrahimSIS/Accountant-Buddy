import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Lovable Cloud normally injects VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY at build time.
// This wrapper provides safe fallbacks so the app doesn't hard-crash if those env vars are missing.
const FALLBACK_URL = "https://bembkmajgvhermgkprin.supabase.co";
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlbWJrbWFqZ3ZoZXJtZ2twcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODEzMzEsImV4cCI6MjA4MjI1NzMzMX0.XvjlDVQ913vimv6UUco739OVEhpNVBBMc8kCq2L7g2Q";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_KEY;

export const supabaseClient = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
