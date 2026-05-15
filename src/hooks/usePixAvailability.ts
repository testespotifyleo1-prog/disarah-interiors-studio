import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

interface PixAvailability {
  loading: boolean;
  pixEnabled: boolean;
  country: string | null;
  reason: string;
}

let cache: PixAvailability | null = null;
let inflight: Promise<PixAvailability> | null = null;

async function fetchAvailability(): Promise<PixAvailability> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase.functions.invoke("check-pix-availability", {
      body: { environment: getStripeEnvironment() },
    });

    const result: PixAvailability = {
      loading: false,
      pixEnabled: !error && !!data?.pixEnabled,
      country: data?.country ?? null,
      reason: data?.reason ?? (error?.message || ""),
    };
    cache = result;
    inflight = null;
    return result;
  })();

  return inflight;
}

export function usePixAvailability(): PixAvailability {
  const [state, setState] = useState<PixAvailability>(
    cache || { loading: true, pixEnabled: false, country: null, reason: "" },
  );

  useEffect(() => {
    if (cache) return;
    let mounted = true;
    fetchAvailability().then((r) => {
      if (mounted) setState(r);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
