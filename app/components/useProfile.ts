// components/useProfile.ts (или прямо в файле страницы)
"use client";
import { useEffect, useState } from "react";

type Profile = { name?: string; username?: string; city?: string; bio?: string; avatar?: string };
const STORAGE_KEY = "wardrobe.profile.v1";

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(() => {
    if (typeof window === "undefined") return {};
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const onSaved = (e: Event) => {
      const detail = (e as CustomEvent).detail as Profile;
      if (detail) setProfile(detail);
    };
    window.addEventListener("wardrobe:profile-saved", onSaved as EventListener);
    return () => window.removeEventListener("wardrobe:profile-saved", onSaved as EventListener);
  }, []);

  return profile;
}
