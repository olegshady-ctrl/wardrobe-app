// app/wardrobe/WardrobeClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* ===================== Типы ===================== */
export type Season = "Весна" | "Літо" | "Осінь" | "Зима" | "Круглорічно";
export type Category =
  | "Верхній одяг" | "Сорочки" | "Футболки" | "Светри" | "Платья"
  | "Спідниці" | "Штани" | "Джинси" | "Костюми" | "Спорт"
  | "Взуття" | "Аксесуари" | "Інше";

export interface WardrobeItem {
  id: string;
  title: string;
  image: string;
  brand?: string;
  size?: string;
  link?: string;
  price?: number;
  tags?: string[];
  season?: Season;
  purchaseDate?: string;
  material?: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

type Profile = {
  nickname?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  avatarUrl?: string; // "idb:profile:avatar" или http(s) url
  followers?: number;
  following?: number;
};

/* ===================== Константы/ключи ===================== */
const LS_ITEMS_V2 = "wardrobe.items.v2";
const LS_ITEMS_OLD = "wardrobe.items";
const LS_LOOKS_1  = "wardrobe.outfits.v1";
const LS_LOOKS_2  = "wardrobe.looks.v1";
const LS_PROFILE_SETTINGS = "settings.profile";

const IDB_NAME  = "wardrobe-db";
const IDB_STORE = "images-v1";

/* ===================== Утилиты ===================== */
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function shortNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + " млн";
  if (n >= 1000)      return (n / 1000).toFixed(n % 1000 ? 1 : 0) + " тис.";
  return n.toLocaleString("uk-UA");
}
function readLooksCount(): number {
  try {
    const a = localStorage.getItem(LS_LOOKS_1);
    if (a) return (JSON.parse(a) as any[]).length || 0;
    const b = localStorage.getItem(LS_LOOKS_2);
    if (b) return (JSON.parse(b) as any[]).length || 0;
  } catch {}
  return 0;
}

/* ===== IndexedDB для изображений (вещи + аватар) ===== */
function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPutImage(key: string, blob: Blob) {
  const db = await openImageDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}
async function idbGetImageURL(key: string): Promise<string | null> {
  const db = await openImageDB();
  return new Promise((res) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const rq = tx.objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => {
      const blob = rq.result as Blob | undefined;
      res(blob ? URL.createObjectURL(blob) : null);
      db.close();
    };
    rq.onerror = () => { res(null); db.close(); };
  });
}
async function idbDeleteImage(key: string) {
  const db = await openImageDB();
  await new Promise<void>((res) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => res();
  });
  db.close();
}

/* ===== Сжатие загружаемого изображения вещи в WebP ===== */
async function compressFileToWebP(file: File, maxEdge = 1100, quality = 0.85) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.src = dataUrl;
  });
  const scale = Math.min(maxEdge / img.width, maxEdge / img.height, 1);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/webp", quality)
  );
  return { blob };
}

/* ===== Чтение/запись вещей + миграция больших data:URL ===== */
function readItemsSync(): WardrobeItem[] {
  try {
    const v2 = localStorage.getItem(LS_ITEMS_V2);
    if (v2) return JSON.parse(v2) as WardrobeItem[];
    const old = localStorage.getItem(LS_ITEMS_OLD);
    if (old) {
      const arr = JSON.parse(old) as any[];
      return (arr || []).map((x) => ({
        id: x.id || uid(),
        title: x.title || x.name || "Без назви",
        image: x.image || x.img || "",
        brand: x.brand || "",
        size: x.size || "",
        link: x.link || "",
        price: typeof x.price === "number" ? x.price : undefined,
        tags: Array.isArray(x.tags) ? x.tags : [],
        season: (x.season as Season) || "Круглорічно",
        purchaseDate: x.purchaseDate || "",
        material: x.material || "",
        category: x.category || "Інше",
        createdAt: x.createdAt || Date.now(),
        updatedAt: x.updatedAt || Date.now(),
      }));
    }
  } catch {}
  return [];
}
async function migrateLargeImagesToIDB(items: WardrobeItem[]) {
  let changed = false;
  for (const it of items) {
    if (typeof it.image === "string" && it.image.startsWith("data:") && it.image.length > 200_000) {
      const blob = await (await fetch(it.image)).blob();
      const key = `img:${it.id}`;
      await idbPutImage(key, blob);
      it.image = `idb:${key}`;
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(LS_ITEMS_V2, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("wardrobe:items-updated", { detail: items }));
  }
}
function writeItems(items: WardrobeItem[]) {
  try {
    localStorage.setItem(LS_ITEMS_V2, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("wardrobe:items-updated", { detail: items }));
  } catch (e) {
    console.error(e);
    alert("Браузерне сховище заповнене. Великі фото збережено в локальну базу.");
  }
}

/* ===================== Погода та порада ===================== */
type WeatherState = {
  loading: boolean;
  city?: string;
  tempC?: number;
  precip?: number;
  code?: number;
  desc?: string;
  suggestion?: string;
  error?: string;
};
function codeToText(code?: number): string {
  if (code === undefined) return "";
  if (code === 0) return "ясно";
  if ([1,2,3].includes(code)) return "мінлива хмарність";
  if ([45,48].includes(code)) return "туманно";
  if ([51,53,55,56,57].includes(code)) return "мряка";
  if ([61,63,65,80,81,82].includes(code)) return "дощ";
  if ([66,67].includes(code)) return "крижаний дощ";
  if ([71,73,75,77,85,86].includes(code)) return "сніг";
  if ([95,96,99].includes(code)) return "гроза";
  return "погода змінна";
}
function buildSuggestion(t?: number, precip?: number, code?: number): string {
  if (t === undefined) return "";
  let s = "";
  if (t >= 26) s = "щось легке й дихаюче: футболка/лонгслів, шорти або лляні штани, кросівки.";
  else if (t >= 18) s = "легкі шари: футболка + тонка сорочка/легка куртка, світлі тканини.";
  else if (t >= 10) s = "джинси або чіноси + худі/світшот, легка куртка.";
  else if (t >= 4)  s = "теплий светр, куртка, закрите взуття.";
  else              s = "утеплена куртка/пальто, шапка та рукавички.";

  const rainy = (precip ?? 0) > 0.1 || [61,63,65,80,81,82,95,96,99,66,67].includes(code ?? -1);
  const snowy = [71,73,75,77,85,86].includes(code ?? -1);

  if (rainy) s += " Додайте дощовик/парасольку та водостійке взуття.";
  if (snowy) s += " Теплі чоботи та термошари не завадять.";
  return s;
}
function WeatherCard({ profileCity }: { profileCity?: string }) {
  const [w, setW] = useState<WeatherState>({ loading: true });

  useEffect(() => {
    let cancelled = false;

    async function resolveLatLon(): Promise<{lat:number; lon:number; name?:string} | null> {
      const fromGeo = await new Promise<{lat:number; lon:number} | null>((res) => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => res(null),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });
      if (fromGeo) return { ...fromGeo };

      if (profileCity) {
        try {
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(profileCity)}&count=1&language=uk&format=json`);
          const j = await r.json();
          if (j?.results?.length) {
            const g = j.results[0];
            return { lat: g.latitude, lon: g.longitude, name: g.name };
          }
        } catch {}
      }
      return { lat: 46.4825, lon: 30.7233, name: "Одеса" };
    }

    async function load() {
      try {
        const loc = await resolveLatLon();
        if (!loc) throw new Error("no location");
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,precipitation,weather_code&forecast_days=1&timezone=auto`
        );
        const j = await r.json();
        const tempC = j?.current?.temperature_2m as number | undefined;
        const precip = j?.current?.precipitation as number | undefined;
        const code   = j?.current?.weather_code as number | undefined;
        const desc   = codeToText(code);
        const suggestion = buildSuggestion(tempC, precip, code);
        if (!cancelled) setW({ loading:false, city: loc.name || profileCity, tempC, precip, code, desc, suggestion });
      } catch {
        if (!cancelled) setW({ loading:false, error: "Не вдалося завантажити погоду" });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [profileCity]);

  return (
    <div className="rounded-2xl border bg-white p-4">
      {w.loading ? (
        <div className="text-sm text-gray-500">Завантаження погоди…</div>
      ) : w.error ? (
        <div className="text-sm text-gray-500">{w.error}</div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <div className="text-base font-semibold">
              {w.city || "Поточний регіон"}
            </div>
            {typeof w.tempC === "number" && (
              <div className="text-base">{Math.round(w.tempC)}°C</div>
            )}
            {w.desc && <div className="text-sm text-gray-500">• {w.desc}</div>}
          </div>
          <div className="text-sm text-gray-700">{w.suggestion}</div>
        </div>
      )}
    </div>
  );
}

/* ===================== Редактор вещи (модалка) ===================== */
function TagsInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState("");
  function add(tag: string) {
    const t = tag.trim().replace(/^#/, "");
    if (!t) return;
    if (value.includes(t)) return;
    onChange([...value, t]); setText("");
  }
  function remove(t: string) { onChange(value.filter((x) => x !== t)); }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs">
            #{t}
            <button className="text-gray-500" onClick={() => remove(t)} aria-label={`Видалити тег ${t}`}>×</button>
          </span>
        ))}
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "," || e.key === "Enter") { e.preventDefault(); add(text.replace(/,$/, "")); }
        }}
        placeholder="Додайте тег і натисніть Enter або кому"
        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
      />
    </div>
  );
}

function ItemEditor({
  initial, open, onCancel, onSave, onDelete,
}: {
  initial: WardrobeItem; open: boolean;
  onCancel: () => void; onSave: (item: WardrobeItem) => void; onDelete?: (id: string) => void;
}) {
  const [item, setItem] = useState<WardrobeItem>(initial);
  const [preview, setPreview] = useState<string>("");

  useEffect(() => { setItem(initial); setPreview(""); }, [initial]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (item.image?.startsWith("idb:")) {
        const url = await idbGetImageURL(item.image.slice(4));
        if (mounted) setPreview(url || "");
      } else {
        setPreview(item.image || "");
      }
    })();
    return () => { mounted = false; };
  }, [item.image]);

  const seasons: Season[] = ["Весна","Літо","Осінь","Зима","Круглорічно"];
  const categories: Category[] = [
    "Верхній одяг","Сорочки","Футболки","Светри","Платья",
    "Спідниці","Штани","Джинси","Костюми","Спорт","Взуття","Аксесуари","Інше",
  ];

  function update<K extends keyof WardrobeItem>(key: K, value: WardrobeItem[K]) {
    setItem((p) => ({ ...p, [key]: value, updatedAt: Date.now() }));
  }

  return (
    <Modal open={open} onClose={onCancel}>
      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-[300px_1fr]">
        {/* Превью */}
        <div className="flex flex-col items-center gap-3">
          <div className="aspect-square w-full overflow-hidden rounded-lg border">
            {preview ? (
              <img src={preview} alt={item.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Без зображення</div>
            )}
          </div>
          <input
            value={item.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Назва / короткий опис"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
          />
          <div className="text-xs text-gray-500">ID: {item.id.slice(0, 8)}</div>
        </div>

        {/* Форма */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Бренд</label>
              <input value={item.brand || ""} onChange={(e) => update("brand", e.target.value)} placeholder="Nike"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20" />
            </div>
            <div>
              <label className="text-sm font-medium">Розмір</label>
              <input value={item.size || ""} onChange={(e) => update("size", e.target.value)} placeholder="M / 42 / 27"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Посилання</label>
              <input value={item.link || ""} onChange={(e) => update("link", e.target.value)} placeholder="https://..."
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20" />
            </div>
            <div>
              <label className="text-sm font-medium">Ціна, ₴</label>
              <input type="number" step="0.01" value={item.price ?? ""} onChange={(e) => update("price", e.target.value === "" ? undefined : Number(e.target.value))}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Сезон</label>
              <select value={item.season || "Круглорічно"} onChange={(e) => update("season", e.target.value as Season)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20">
                {["Весна","Літо","Осінь","Зима","Круглорічно"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Категорія</label>
              <select value={item.category || "Інше"} onChange={(e) => update("category", e.target.value)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20">
                {["Верхній одяг","Сорочки","Футболки","Светри","Платья","Спідниці","Штани","Джинси","Костюми","Спорт","Взуття","Аксесуари","Інше"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Дата покупки</label>
              <input type="date" value={item.purchaseDate || ""} onChange={(e) => update("purchaseDate", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20" />
            </div>
            <div>
              <label className="text-sm font-medium">Матеріал</label>
              <input value={item.material || ""} onChange={(e) => update("material", e.target.value)} placeholder="Бавовна, шкіра..."
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Теги</label>
            <TagsInput value={item.tags || []} onChange={(tags) => update("tags", tags)} />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            {onDelete ? (
              <button onClick={() => onDelete(item.id)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white">Видалити</button>
            ) : <span />}
            <div className="flex gap-2">
              <button onClick={onCancel} className="rounded-lg border px-3 py-2 text-sm">Скасувати</button>
              <button onClick={() => onSave(item)} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">Зберегти</button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ===================== Модалка-обёртка ===================== */
function Modal({ open, onClose, children }:
  React.PropsWithChildren<{ open: boolean; onClose: () => void }>) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(960px,95vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl">
        {children}
      </div>
    </div>
  );
}

/* ===================== Главный компонент ===================== */
export default function WardrobeClient() {
  // ВЕЩИ
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WardrobeItem | null>(null);
  const [imageURLs, setImageURLs] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ПРОФИЛЬ (из /api/settings + localStorage)
  const [profile, setProfile] = useState<Profile>({});
  const [avatarURL, setAvatarURL] = useState<string>("");

  // загрузка профиля
  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = res.ok ? await res.json() : {};
        let p: Profile = data.profile || {};
        try {
          const fromLS = localStorage.getItem(LS_PROFILE_SETTINGS);
          if (fromLS) p = { ...p, ...(JSON.parse(fromLS) as Profile) };
        } catch {}
        if (!cancelled) setProfile(p);
      } catch {
        try {
          const fromLS = localStorage.getItem(LS_PROFILE_SETTINGS);
          if (fromLS) setProfile(JSON.parse(fromLS));
        } catch {}
      }
    }
    loadProfile();

    // слушаем сохранение с профайл-страницы
    const onSaved = (e: any) => {
      const p = (e?.detail || {}) as Profile;
      setProfile((prev) => ({ ...prev, ...p }));
    };
    window.addEventListener("wardrobe:profile-saved", onSaved);
    return () => {
      cancelled = true;
      window.removeEventListener("wardrobe:profile-saved", onSaved);
    };
  }, []);

  // превью аватара (поддержка idb:)
  useEffect(() => {
    let revoke = "";
    (async () => {
      if (profile.avatarUrl?.startsWith("idb:")) {
        const url = await idbGetImageURL(profile.avatarUrl.slice(4));
        if (url) {
          setAvatarURL(url);
          revoke = url;
        } else setAvatarURL("");
      } else if (profile.avatarUrl) {
        setAvatarURL(profile.avatarUrl);
      } else {
        setAvatarURL("");
      }
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [profile.avatarUrl]);

  // инициалы справа сверху — из ника
  const nick = profile.nickname || "Профіль";
  const topRightInitials = useMemo(() => {
    const clean = (profile.nickname || "").replace(/[^a-zA-Z0-9]+/g, "");
    const two = clean.slice(0, 2).toUpperCase();
    return two || "U";
  }, [profile.nickname]);

  const looksCount = readLooksCount();
  const followersCount = typeof profile.followers === "number" ? profile.followers : 0;
  const followingCount = typeof profile.following === "number" ? profile.following : 0;

  // ВЕЩИ: загрузка/миграция
  useEffect(() => {
    const init = readItemsSync();
    setItems(init);
    (async () => { await migrateLargeImagesToIDB(init); })();

    const onUpdated = (e: any) => setItems(e?.detail || readItemsSync());
    window.addEventListener("wardrobe:items-updated", onUpdated);
    return () => window.removeEventListener("wardrobe:items-updated", onUpdated);
  }, []);

  // разворачиваем idb: для карточек
  useEffect(() => {
    items.forEach(async (it) => {
      if (it.image?.startsWith("idb:") && !imageURLs[it.id]) {
        const url = await idbGetImageURL(it.image.slice(4));
        if (url) setImageURLs((m) => ({ ...m, [it.id]: url }));
      }
    });
  }, [items]); // eslint-disable-line

  function persist(next: WardrobeItem[]) {
    setItems(next);
    writeItems(next);
  }
  function addByUrl(url: string) {
    if (!url) return;
    const now = Date.now();
    const base: WardrobeItem = {
      id: uid(), title: "Без назви", image: url,
      createdAt: now, updatedAt: now, season: "Круглорічно", tags: [], category: "Інше",
    };
    setEditing(base); setEditorOpen(true);
  }
  async function onUploadFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Оберіть файл-зображення");
    const now = Date.now();
    const id  = uid();
    const key = `img:${id}`;
    const { blob } = await compressFileToWebP(file, 1100, 0.85);
    await idbPutImage(key, blob);
    const base: WardrobeItem = {
      id, title: "Без назви", image: `idb:${key}`,
      createdAt: now, updatedAt: now, season: "Круглорічно", tags: [], category: "Інше",
    };
    setEditing(base); setEditorOpen(true);
  }
  function saveItem(updated: WardrobeItem) {
    const exists = items.some((x) => x.id === updated.id);
    const next = exists
      ? items.map((x) => (x.id === updated.id ? { ...updated, updatedAt: Date.now() } : x))
      : [{ ...updated, updatedAt: Date.now() }, ...items];
    persist(next);
    setEditorOpen(false); setEditing(null);
  }
  async function deleteItem(id: string) {
    const item = items.find((x) => x.id === id);
    if (item?.image?.startsWith("idb:")) await idbDeleteImage(item.image.slice(4));
    const next = items.filter((x) => x.id !== id);
    persist(next);
    setEditorOpen(false); setEditing(null);
  }
  function openEditor(item: WardrobeItem) { setEditing(item); setEditorOpen(true); }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      it.title.toLowerCase().includes(q) ||
      (it.brand || "").toLowerCase().includes(q) ||
      (it.category || "").toLowerCase().includes(q) ||
      (it.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [items, query]);

  const resolveImg = (it: WardrobeItem) =>
    it.image?.startsWith("idb:") ? (imageURLs[it.id] || "") : it.image;

  return (
    <>
      {/* ВЕРХНИЙ ХЕДЕР: шестерёнка + инициалы ника справа */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 md:px-8 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Гардероб</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              title="Налаштування"
              className="h-9 w-9 grid place-items-center rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              ⚙️
            </Link>
            <Link
              href="/profile"
              title={nick ? `@${nick}` : "Профіль"}
              className="h-9 w-9 rounded-full bg-gray-900 text-white grid place-items-center text-xs font-semibold"
            >
              {topRightInitials}
            </Link>
          </div>
        </div>
      </div>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
        {/* Профильный блок */}
        <div className="mb-6 rounded-2xl border bg-white p-4 md:p-6">
          <div className="grid grid-cols-[96px_1fr] gap-4 md:grid-cols-[120px_1fr]">
            {/* AVATAR big */}
            <div className="flex items-start justify-center">
              <div className="h-24 w-24 overflow-hidden rounded-full bg-gray-200 ring-2 ring-black/10 md:h-28 md:w-28">
                {avatarURL ? (
                  <img src={avatarURL} alt="avatar" className="h-full w-full object-cover" />
                ) : null}
              </div>
            </div>

            {/* Name + counts */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xl font-semibold md:text-2xl">
                  {profile.nickname || "Профіль"}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div><span className="font-semibold">{shortNum(looksCount)}</span> луків</div>
                <div><span className="font-semibold">{shortNum(followersCount)}</span> підписники</div>
                <div><span className="font-semibold">{shortNum(followingCount)}</span> підписки</div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <WeatherCard profileCity={profile.city} />
          </div>
        </div>

        {/* Поиск + добавление */}
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Пошук по назві, бренду або тегу"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-72 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20"
            />
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => fileInputRef.current?.click()}>
              Завантажити фото
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onUploadFile(e.target.files?.[0] || undefined)}
            />
            <button
              className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white"
              onClick={() => {
                const url = prompt("Вставте URL зображення речі");
                if (url) addByUrl(url);
              }}
            >
              Додати по URL
            </button>
          </div>
        </div>

        {/* Грид вещей */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-sm text-gray-500">
            Немає речей. Додайте зображення через кнопки вище — і заповніть атрибути.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((it) => (
              <button
                key={it.id}
                onClick={() => openEditor(it)}
                className="group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-square w-full overflow-hidden">
                  {resolveImg(it) ? (
                    <img src={resolveImg(it)} alt={it.title}
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">Фото завантажується…</div>
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium">{it.title || it.brand || "Без назви"}</div>
                    {typeof it.price === "number" && (
                      <div className="whitespace-nowrap text-sm font-semibold">
                        {Math.round(it.price).toLocaleString("uk-UA")} ₴
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(it.brand || "—") + (it.category ? ` • ${it.category}` : "")}
                  </div>
                  {it.tags && it.tags.length > 0 && (
                    <div className="line-clamp-1 text-xs text-gray-500">#{it.tags.join(" #")}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Редактор вещи */}
        {editing && (
          <ItemEditor
            initial={editing}
            open={editorOpen}
            onCancel={() => { setEditorOpen(false); setEditing(null); }}
            onSave={saveItem}
            onDelete={deleteItem}
          />
        )}
      </div>
    </>
  );
}
