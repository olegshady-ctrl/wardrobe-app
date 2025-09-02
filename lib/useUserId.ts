"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getLocalUserId } from "@/lib/localUser";

/**
 * Возвращает userId: если есть сессия Supabase — берем ее,
 * иначе создаем/читаем локальный uid из localStorage.
 * Делаем это только на клиенте.
 */
export function useUserId() {
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id || getLocalUserId();
        if (!cancelled) setUserId(uid);
      } catch {
        if (!cancelled) setUserId(getLocalUserId());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return userId;
}
