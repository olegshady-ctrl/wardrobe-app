'use client';
import React, { useEffect, useMemo, useState } from 'react';

// где хранятся луки
const STORAGE_KEYS = ['wardrobe_looks', 'looks', 'outfits'];
const META_KEY = 'looks_meta';

type Look = {
  id: string;
  title?: string;
  createdAt?: number;
  photoDataUrl?: string;
  collageDataUrl?: string;
  // ► для карусели элементов. Заполняется, если при сохранении лука вы положили items.
  elements?: { id?: string; src: string; name?: string }[];
};

type Meta = Record<
  string,
  { likes: number; liked: boolean; comments: { id: string; text: string; date: number }[] }
>;

function readJSON<T = any>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJSON(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

function normalize(it: any, sourceKey: string): Look | null {
  if (!it) return null;
  const id = it.id ?? it._id ?? `${sourceKey}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    title: it.title || it.name || 'Без назви',
    createdAt: Number(it.createdAt || it.date || Date.now()),
    photoDataUrl: it.photoDataUrl || it.photo || it.basePhoto,
    collageDataUrl: it.collageDataUrl || it.collage || it.canvasImage || it.preview,
    elements: it.elements || it.items || it.usedItems || undefined,
  };
}

export default function LooksPage() {
  const [looks, setLooks] = useState<Look[]>([]);
  const [meta, setMeta] = useState<Meta>({});

  useEffect(() => {
    const loaded: Look[] = [];
    for (const key of STORAGE_KEYS) {
      const arr = readJSON<any[]>(key);
      if (Array.isArray(arr)) arr.forEach((x) => { const n = normalize(x, key); if (n) loaded.push(n); });
    }
    // dedupe by id, newest first
    const byId = new Map<string, Look>();
    for (const l of loaded) {
      const ex = byId.get(l.id);
      if (!ex || (l.createdAt || 0) > (ex.createdAt || 0)) byId.set(l.id, l);
    }
    const list = Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setLooks(list);
    setMeta(readJSON<Meta>(META_KEY) || {});
  }, []);

  const saveMeta = (next: Meta) => {
    setMeta(next);
    writeJSON(META_KEY, next);
  };

  const onToggleLike = (id: string) => {
    const m = meta[id] || { likes: 0, liked: false, comments: [] };
    const liked = !m.liked;
    const likes = Math.max(0, (m.likes || 0) + (liked ? 1 : -1));
    saveMeta({ ...meta, [id]: { ...m, liked, likes } });
  };

  const onAddComment = (id: string, text: string) => {
    const t = text.trim(); if (!t) return;
    const m = meta[id] || { likes: 0, liked: false, comments: [] };
    const c = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: t, date: Date.now() };
    saveMeta({ ...meta, [id]: { ...m, comments: [...(m.comments || []), c] } });
  };

  const onDelete = (id: string) => {
    if (!confirm('Видалити лук назавжди?')) return;
    for (const key of STORAGE_KEYS) {
      const arr = readJSON<any[]>(key);
      if (Array.isArray(arr)) writeJSON(key, arr.filter((x) => (x.id || x._id) !== id));
    }
    const m = { ...meta }; delete m[id]; saveMeta(m);
    setLooks((p) => p.filter((l) => l.id !== id));
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Мої образи</h1>
        <a href="/zibraty-luk" className="px-4 py-2 rounded-2xl border bg-white shadow">+ Створити</a>
      </div>

      {looks.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-20">
          Поки що порожньо — створіть перший лук у конструкторі.
        </div>
      ) : (
        <ul className="space-y-6">
          {looks.map((look) => (
            <li key={look.id} className="rounded-2xl border bg-white shadow-sm p-4">
              <LookCard look={look}
                        meta={meta[look.id] || { likes: 0, liked: false, comments: [] }}
                        onLike={() => onToggleLike(look.id)}
                        onDelete={() => onDelete(look.id)}
                        onAddComment={(t) => onAddComment(look.id, t)} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function LookCard({
  look,
  meta,
  onLike,
  onDelete,
  onAddComment,
}: {
  look: Look;
  meta: { likes: number; liked: boolean; comments: { id: string; text: string; date: number }[] };
  onLike: () => void;
  onDelete: () => void;
  onAddComment: (text: string) => void;
}) {
  // 0 = photo, 1 = collage
  const [slide, setSlide] = useState(look.photoDataUrl ? 0 : 1);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const date = new Date(Number(look.createdAt || Date.now())).toLocaleString();

  const slides = [
    look.photoDataUrl ? { key: 'photo', url: look.photoDataUrl, label: 'Фото' } : null,
    look.collageDataUrl ? { key: 'collage', url: look.collageDataUrl, label: 'Колаж' } : null,
  ].filter(Boolean) as { key: 'photo' | 'collage'; url: string; label: string }[];

  // свайп: 50px порог
  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const threshold = 50;
    if (dx < -threshold && slide < slides.length - 1) setSlide(slide + 1);
    else if (dx > threshold && slide > 0) setSlide(slide - 1);
    setTouchStartX(null);
  };

  const goto = (idx: number) => {
    if (idx >= 0 && idx < slides.length) setSlide(idx);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* шапка */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold leading-tight">{look.title || 'Без назви'}</div>
          <div className="text-xs text-gray-500 mt-0.5">Опубліковано • {date}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onLike} className={`px-3 py-1.5 rounded-xl border ${meta.liked ? 'bg-rose-50 border-rose-200' : 'bg-white'}`}>
            <span className="mr-1">{meta.liked ? '❤️' : '🤍'}</span>{meta.likes}
          </button>
          <button onClick={onDelete} className="px-3 py-1.5 rounded-xl border text-red-600">Видалити</button>
        </div>
      </div>

      {/* большой блок 9×16 со свайпом */}
      <div className="w-full flex justify-center">
        <div className="rounded-2xl border overflow-hidden shadow" style={{ width: 360, maxWidth: '100%', aspectRatio: '9 / 16' }}>
          <div
            className="h-full w-full flex transition-transform duration-300"
            style={{ transform: `translateX(-${slide * 100}%)` }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {slides.map((s) => (
              <div key={s.key} className="w-full h-full shrink-0 bg-white grid place-items-center">
                <img src={s.url} alt={s.label} className="w-full h-full object-contain" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* точки/переключатели */}
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => goto(i)} className={`h-2 w-2 rounded-full ${i === slide ? 'bg-gray-900' : 'bg-gray-300'}`} aria-label={`goto ${i}`} />
          ))}
        </div>
      )}

      {/* карусель елементів під фото/колажем */}
      <div className="border rounded-2xl p-3 bg-gray-50">
        <div className="text-sm font-medium mb-2">Елементи образу</div>
        {look.elements && look.elements.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {look.elements.map((el, idx) => (
              <div key={el.id || idx} className="shrink-0 w-20 h-28 rounded-xl overflow-hidden bg-white border shadow-sm grid place-items-center">
                <img src={el.src} alt={el.name || 'item'} className="w-full h-full object-contain" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500">Елементи не збережені для цього лука.</div>
        )}
      </div>

      {/* комментарии */}
      <div className="space-y-2">
        <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
          {(meta.comments || []).map((c) => (
            <div key={c.id} className="text-sm px-3 py-2 rounded-xl bg-gray-50 border">
              <div className="text-[11px] text-gray-500 mb-1">{new Date(c.date).toLocaleString()}</div>
              <div className="whitespace-pre-wrap">{c.text}</div>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); onAddComment(comment); setComment(''); }}
          className="flex items-center gap-2"
        >
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Залишити коментар…"
            className="flex-1 px-4 py-2 rounded-2xl border"
          />
          <button className="px-3 py-2 rounded-2xl border bg-white shadow">Надіслати</button>
        </form>
      </div>
    </div>
  );
}
