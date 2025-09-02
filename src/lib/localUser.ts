"use client";
export function getLocalUserId(): string {
  const KEY = "wardrobe_local_uid";
  let uid = localStorage.getItem(KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem(KEY, uid);
  }
  return uid;
}
