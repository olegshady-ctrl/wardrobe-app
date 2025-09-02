"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* ===================== Типи ===================== */
type Shipping = { fullName?: string; city?: string };
type Payment  = { holder?: string; last4?: string; expMonth?: string; expYear?: string };
type Sizing   = { gender?: "male" | "female" | "other"; height?: string; weight?: string };
type GenderUI = "Жінка" | "Чоловік" | "Не вказано";

type Profile = {
  nickname?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  gender?: "female" | "male" | "other";
  birthdate?: string;            // YYYY-MM-DD
  avatarUrl?: string;            // "idb:profile:avatar" або http(s) url
};

type SettingsPayload = {
  shipping?: Shipping;
  payment?: Payment;
  sizing?: Sizing;
  profile?: Profile;
};

const LS = {
  profile: "settings.profile",
  shipping: "settings.shipping",
  payment: "settings.payment",
  sizing: "settings.sizing",
};

/* ===================== IndexedDB для аватара ===================== */
const IDB_NAME = "wardrobe-db";
const IDB_STORE = "images-v1";
const AVATAR_KEY = "profile:avatar";

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
async function idbPut(key: string, blob: Blob) {
  const db = await openImageDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}
async function idbGetURL(key: string): Promise<string | null> {
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
async function compressToWebP(file: File, maxEdge = 600, quality = 0.9) {
  const src = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.src = src;
  });
  const k = Math.min(maxEdge / img.width, maxEdge / img.height, 1);
  const w = Math.round(img.width * k);
  const h = Math.round(img.height * k);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/webp", quality)
  );
  return blob;
}

/* ===================== Валідація та маски ===================== */
// маска ника: латиница, цифры, "_", ".", "-" ; без пробелов/кириллицы; в нижний регистр; длина 0..24
function maskNickname(input: string): string {
  const lower = input.toLowerCase();
  let s = lower.replace(/[^a-z0-9._-]+/g, "");     // удаляем все, кроме разрешённых
  s = s.replace(/([._-])\1+/g, "$1");             // схлопываем подряд идущие символы
  return s.slice(0, 24);
}
function validateNickname(nick: string): string | null {
  if (!nick) return "Вкажіть нікнейм";
  if (nick.length < 3) return "Щонайменше 3 символи";
  if (nick.length > 24) return "Не більше 24 символів";
  if (!/^[a-z0-9._-]+$/.test(nick)) return "Лише латиниця, цифри, «._-»";
  if (/^[._-]/.test(nick) || /[._-]$/.test(nick)) return "Не може починатися/закінчуватися «._-»";
  if (/\.\.|__|--/.test(nick)) return "Без повторів «..», «__», «--»";
  return null;
}
function validateName(s: string): string | null {
  if (!s) return "Поле обов’язкове";
  if (s.trim().length < 2) return "Мінімум 2 символи";
  if (s.length > 50) return "Занадто довге";
  if (!/^[\p{L}.'\-\s]+$/u.test(s)) return "Дозволені літери, пробіли, апостроф, дефіс";
  return null;
}
function validateCity(s: string): string | null {
  if (!s) return "Поле обов’язкове";
  if (s.trim().length < 2) return "Мінімум 2 символи";
  if (s.length > 50) return "Занадто довге";
  if (!/^[\p{L}.'\-\s]+$/u.test(s)) return "Дозволені літери, пробіли, апостроф, дефіс";
  return null;
}
function validateBirthdate(s: string): string | null {
  if (!s) return null; // необов'язково
  const d = new Date(s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "Невірна дата";
  const today = new Date();
  if (d > today) return "Дата з майбутнього";
  const age = today.getFullYear() - d.getFullYear() - (today < new Date(today.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  if (age < 5) return "Мінімум 5 років";
  if (age > 120) return "Максимум 120 років";
  if (d < new Date("1900-01-01")) return "Дата занадто давня";
  return null;
}

/* ===================== Сторінка профілю ===================== */
export default function ProfilePage() {
  const [shipping, setShipping] = useState<Shipping>({});
  const [payment,  setPayment]  = useState<Payment>({});
  const [sizing,   setSizing]   = useState<Sizing>({});
  const [profile,  setProfile]  = useState<Profile>({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data: SettingsPayload = res.ok ? await res.json() : {};
        setShipping(data.shipping || {});
        setPayment(data.payment || {});
        setSizing(data.sizing || {});
        let pr: Profile = { ...(data.profile || {}) };
        try {
          const fromLS = localStorage.getItem(LS.profile);
          if (fromLS) pr = { ...pr, ...(JSON.parse(fromLS) as Profile) };
        } catch {}
        setProfile(pr);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let revoke = "";
    (async () => {
      if (profile.avatarUrl?.startsWith("idb:")) {
        const key = profile.avatarUrl.slice(4);
        const url = await idbGetURL(key);
        if (url) {
          setAvatarPreview(url);
          revoke = url;
        } else setAvatarPreview("");
      } else if (profile.avatarUrl) {
        setAvatarPreview(profile.avatarUrl);
      } else {
        setAvatarPreview("");
      }
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [profile.avatarUrl]);

  async function persist(nextProfile: Profile) {
    setSaving(true);
    try {
      const body: SettingsPayload = { shipping, payment, sizing, profile: nextProfile };
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save failed");
      try { localStorage.setItem(LS.profile, JSON.stringify(nextProfile)); } catch {}
      setProfile(nextProfile);
    } catch {
      try { localStorage.setItem(LS.profile, JSON.stringify(nextProfile)); } catch {}
      setProfile(nextProfile);
    } finally {
      setSaving(false);
      window.dispatchEvent(new CustomEvent("wardrobe:profile-saved", { detail: nextProfile }));
    }
  }

  const uiGender: GenderUI =
    profile.gender === "female" ? "Жінка" :
    profile.gender === "male"   ? "Чоловік" : "Не вказано";

  function uiToCodeGender(g: GenderUI): Profile["gender"] {
    if (g === "Жінка") return "female";
    if (g === "Чоловік") return "male";
    return "other";
  }

  // аватар
  const fileRef = useRef<HTMLInputElement>(null);
  async function handleAvatarFile(f?: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return alert("Оберіть файл-зображення");
    const blob = await compressToWebP(f, 600, 0.9);
    await idbPut(AVATAR_KEY, blob);
    const next = { ...profile, avatarUrl: `idb:${AVATAR_KEY}` };
    await persist(next);
  }

  const initials = useMemo(() => {
    const a = profile.firstName?.[0] ?? profile.nickname?.[0] ?? "";
    const b = profile.lastName?.[0] ?? "";
    const s = (a + b).toUpperCase();
    return s || "U";
  }, [profile.firstName, profile.lastName, profile.nickname]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="px-5 py-4 border-b border-gray-200 sticky top-0 bg-white/70 backdrop-blur z-30">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Профіль</h1>
          <Link
            href="/wardrobe"
            className="inline-flex items-center gap-2 text-sm px-3 h-9 rounded-lg border border-gray-300 hover:bg-gray-50"
            title="До гардероба"
          >
            ← До гардероба
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <section className="rounded-2xl border border-gray-200 p-6 flex flex-col sm:flex-row gap-6">
          {/* Аватар + кнопка */}
          <div className="w-full sm:w-auto">
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden border border-gray-200 bg-gray-100 grid place-items-center">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-gray-700">{initials}</span>
              )}
            </div>
            <div className="mt-3">
              <button
                className="h-9 w-full sm:w-auto px-3 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                onClick={() => fileRef.current?.click()}
              >
                Редагувати аватар
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarFile(e.target.files?.[0])}
              />
            </div>

            {saving && <p className="text-xs text-gray-500 mt-2">Збереження…</p>}
          </div>

          {/* Поля з інлайновим редагуванням + валідацією */}
          <div className="grid gap-5 sm:grid-cols-2 flex-1">
            <EditableRow
              label="Нікнейм"
              value={profile.nickname ? `@${profile.nickname}` : ""}
              rawValue={profile.nickname || ""}
              type="text"
              placeholder="@username"
              mask={maskNickname}
              validate={(v) => validateNickname(v)}
              onSave={async (v) => {
                const nv = maskNickname(v).replace(/^@/, "");
                await persist({ ...profile, nickname: nv });
              }}
            />
            <EditableRow
              label="Місто"
              value={profile.city || ""}
              rawValue={profile.city || ""}
              type="text"
              placeholder="Місто"
              validate={validateCity}
              onSave={async (v) => persist({ ...profile, city: v })}
            />
            <EditableRow
              label="Ім’я"
              value={profile.firstName || ""}
              rawValue={profile.firstName || ""}
              type="text"
              placeholder="Ім’я"
              validate={validateName}
              onSave={async (v) => persist({ ...profile, firstName: v })}
            />
            <EditableRow
              label="Прізвище"
              value={profile.lastName || ""}
              rawValue={profile.lastName || ""}
              type="text"
              placeholder="Прізвище"
              validate={validateName}
              onSave={async (v) => persist({ ...profile, lastName: v })}
            />
            <EditableRow
              label="Стать"
              value={uiGender}
              rawValue={uiGender}
              type="select"
              options={["Жінка", "Чоловік", "Не вказано"]}
              onSave={async (v) => persist({ ...profile, gender: uiToCodeGender(v as GenderUI) })}
            />
            <EditableRow
              label="Дата народження"
              value={profile.birthdate || ""}
              rawValue={profile.birthdate || ""}
              type="date"
              validate={validateBirthdate}
              onSave={async (v) => persist({ ...profile, birthdate: v })}
            />
          </div>
        </section>

        {loading && <p className="text-sm text-gray-500 mt-4">Завантаження…</p>}
      </main>
    </div>
  );
}

/* ===================== Рядок з інлайновим редактором ===================== */
function EditableRow(props: {
  label: string;
  value: string;
  rawValue: string;
  type: "text" | "select" | "date";
  placeholder?: string;
  options?: string[];
  mask?: (v: string) => string;                // маска (преобразование при вводе)
  validate?: (v: string) => string | null;     // повертає текст помилки або null
  onSave: (val: string) => Promise<void> | void;
}) {
  const { label, value, rawValue, type, placeholder, options = [], mask, validate, onSave } = props;
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(rawValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) { setLocal(rawValue); setError(null); }
  }, [rawValue, editing]);

  function onChange(v: string) {
    const next = mask ? mask(v) : v;
    setLocal(next);
    if (validate) setError(validate(next));
  }

  async function commit() {
    const err = validate ? validate(local) : null;
    setError(err);
    if (err) return;
    setSaving(true);
    try { await onSave(local); setEditing(false); }
    finally { setSaving(false); }
  }
  function cancel() { setEditing(false); setLocal(rawValue); setError(null); }

  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${error ? "border-red-300" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={`text-xs ${error ? "text-red-600" : "text-gray-500"}`}>{label}</div>

          {!editing ? (
            <div className={`text-base font-medium break-words ${!value ? "text-gray-400" : ""}`}>
              {value || "—"}
            </div>
          ) : type === "text" ? (
            <input
              autoFocus
              value={local}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              placeholder={placeholder}
              className={`mt-0.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                error ? "border-red-300 focus:ring-red-200" : "focus:ring-gray-300"
              }`}
            />
          ) : type === "date" ? (
            <input
              autoFocus
              type="date"
              value={local}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              className={`mt-0.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                error ? "border-red-300 focus:ring-red-200" : "focus:ring-gray-300"
              }`}
            />
          ) : (
            <select
              autoFocus
              value={local}
              onChange={(e) => onChange(e.target.value)}
              className="mt-0.5 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
            >
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}

          {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
        </div>

        {/* Кнопки справа */}
        {!editing ? (
          <button
            className="h-8 w-8 shrink-0 grid place-items-center rounded-lg hover:bg-gray-100"
            onClick={() => setEditing(true)}
            title="Редагувати"
          >
            <PenIcon />
          </button>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="h-8 px-2 rounded-lg border text-sm hover:bg-gray-50"
              onClick={cancel}
            >
              Скасувати
            </button>
            <button
              className="h-8 px-3 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
              onClick={commit}
              disabled={saving || !!error}
            >
              {saving ? "Збереження…" : "Зберегти"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== Іконка олівця ===================== */
function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-700" fill="currentColor" aria-hidden>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.46a1.003 1.003 0 0 0 0-1.42l-2.08-2.08a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.58-1.58Z"/>
    </svg>
  );
}
