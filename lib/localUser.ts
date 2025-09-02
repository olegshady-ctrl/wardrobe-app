// lib/localUser.ts
/**
 * Возвращает стабильный локальный uid, записанный в localStorage.
 * На сервере/во время пререндеринга ничего не читает (возвращает пустую строку),
 * а реальный uid проставляется на клиенте через useEffect (см. useUserId).
 */
export function getLocalUserId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    // SSR/edge — не трогаем localStorage; uid назначим уже в браузере
    return "";
  }

  const KEY = "wardrobe_local_uid";
  let uid = window.localStorage.getItem(KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    window.localStorage.setItem(KEY, uid);
  }
  return uid;
}
