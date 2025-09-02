'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Look = {
  id: string;
  title?: string;
  createdAt?: number;
  photoDataUrl?: string;
  collageDataUrl?: string;
  elements?: { id?: string; src: string; name?: string }[];
};

type MetaEntry = {
  likes: number;
  liked: boolean;
  comments: { id: string; text: string; date: number }[];
};

const STORAGE_KEYS = ['wardrobe_looks', 'looks', 'outfits'];
const META_KEY = 'looks_meta';

function readJSON<T = any>(k: string): T | null {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

function writeJSON(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

function loadLookById(id: string): Look | null {
  for (const key of STORAGE_KEYS) {
    const arr = readJSON<any[]>(key);
    if (!Array.isArray(arr)) continue;
    const found = arr.find((x) => (x.id || x._id) === id);
    if (found) {
      return {
        id: found.id || found._id,
        title: found.title || found.name || 'Без назви',
        createdAt: Number(found.createdAt || found.date || Date.now()),
        photoDataUrl: found.photoDataUrl || found.photo || found.basePhoto,
        collageDataUrl: found.collageDataUrl || found.collage || found.canvasImage || found.preview,
        elements: found.elements || found.items || found.usedItems || [],
      };
    }
  }
  return null;
}

export default function LookViewPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [look, setLook] = useState<Look | null>(null);
  const [meta, setMeta] = useState<MetaEntry>({ likes: 0, liked: false, comments: [] });

  useEffect(() => {
    // загрузка лука
    setLook(loadLookById(id));
    // загрузка мета
    const allMeta = readJSON<Record<string, MetaEntry>>(META_KEY) || {};
    const m = allMeta[id] || { likes: 0, liked: false, comments: [] };
    setMeta(m);
  }, [id]);

  const saveMeta = (next: MetaEntry) => {
    setMeta(next);
    const all = readJSON<Record<string, MetaEntry>>(META_KEY) || {};
    writeJSON(META_KEY, { ...all, [id]: next });
  };

  const onToggleLike = () => {
    const liked = !meta.liked;
    const likes = Math.max(0, (meta.likes || 0) + (liked ? 1 : -1));
    saveMeta({ ...meta, liked, likes });
  };

  const [comment, setComment] = useState('');
  const onAddComment = (text: string) => {
    const t = text.trim(); if (!t) return;
    const c = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: t, date: Date.now() };
    saveMeta({ ...meta, comments: [...(meta.comments || []), c] });
    setComment('');
  };

  if (!look) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-center text-sm text-gray-500">Лук не знайдено.</div>
      </main>
    );
  }

  return <LookCard look={look} meta={meta} onLike={onToggleLike} onSend={() => onAddComment(comment)} comment={comment} setComment={setComment} />;
}

function LookCard({
  look,
  meta,
  onLike,
  onSend,
  comment,
  setComment,
}: {
  look: Look;
  meta: MetaEntry;
  onLike: () => void;
  onSend: () => void;
  comment: string;
  setComment: (v: string) => void;
}) {
  // Фото ↔ Колаж
  const slides = useMemo(
    () =>
      [
        look.photoDataUrl ? { key: 'photo' as const, url: look.photoDataUrl, label: 'Фото' } : null,
        look.collageDataUrl ? { key: 'collage' as const, url: look.collageDataUrl, label: 'Колаж' } : null,
      ].filter(Boolean) as { key: 'photo' | 'collage'; url: string; label: string }[],
    [look.photoDataUrl, look.collageDataUrl]
  );
  const [slide, setSlide] = useState(look.photoDataUrl ? 0 : 1);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const thr = 50;
    if (dx < -thr && slide < slides.length - 1) setSlide(slide + 1);
    else if (dx > thr && slide > 0) setSlide(slide - 1);
    setTouchStartX(null);
  };

  const date = new Date(Number(look.createdAt || Date.now())).toLocaleString();

  return (
    <main className="max-w-3xl mx-auto px-4 pb-8">
      {/* заголовок как в IG */}
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="h-14 flex items-center justify-center">
          <div className="text-lg font-semibold truncate">{look.title || 'Без назви'}</div>
        </div>
      </div>

      {/* карточка поста */}
      <article className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {/* большой медиаблок 9×16 */}
        <div className="w-full flex justify-center p-4">
          <div className="rounded-2xl bg-gray-50 border overflow-hidden" style={{ width: 360, maxWidth: '100%', aspectRatio: '9 / 16' }}>
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

        {/* точки-переключатели */}
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-2 pb-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`h-1.5 w-1.5 rounded-full ${i === slide ? 'bg-gray-900' : 'bg-gray-300'}`}
                aria-label={`goto ${i}`}
              />
            ))}
          </div>
        )}

        {/* мини-карусель элементов */}
        {look.elements?.length ? (
          <div className="px-3 pb-3">
            <div className="text-sm font-medium px-1 mb-2">Елементи образу</div>
            <div className="flex gap-3 overflow-x-auto pb-1 px-1">
              {look.elements.map((el, idx) => (
                <div key={el.id || idx} className="shrink-0 w-20 h-28 rounded-xl overflow-hidden bg-white border shadow-sm grid place-items-center">
                  <img src={el.src} alt={el.name || 'item'} className="w-full h-full object-contain" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* подпись как в Instagram */}
        <div className="px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap">
          <span className="font-semibold mr-2">Опис:</span>
          {look.title || 'Без назви'}
          <div className="text-[11px] text-gray-500 mt-1">{date}</div>
        </div>

        {/* блок действий: лайк + кол-во */}
        <div className="px-4 py-2 flex items-center gap-3">
          <button
            onClick={onLike}
            className={`px-3 py-1.5 rounded-xl border ${meta.liked ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white'}`}
            aria-label="like"
          >
            {meta.liked ? '❤️' : '🤍'} <span className="ml-1">{meta.likes}</span>
          </button>
        </div>

        {/* комментарии */}
        <div className="px-4 pb-4">
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {(meta.comments || []).map((c) => (
              <div key={c.id} className="text-sm px-3 py-2 rounded-xl bg-gray-50 border">
                <div className="text-[11px] text-gray-500 mb-1">{new Date(c.date).toLocaleString()}</div>
                <div className="whitespace-pre-wrap">{c.text}</div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="mt-2 flex items-center gap-2"
          >
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Додайте коментар…"
              className="flex-1 px-4 py-2 rounded-2xl border"
            />
            <button className="px-3 py-2 rounded-2xl border bg-white shadow">Надіслати</button>
          </form>
        </div>
      </article>
    </main>
  );
}
