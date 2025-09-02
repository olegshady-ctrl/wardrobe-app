'use client';

import React, { useEffect, useMemo, useState } from "react";
import { Heart, MessageSquareText, Trash2, Image as ImageIcon, Layers, Plus, X } from "lucide-react";

/**
 * ОБНОВЛЁННАЯ СТРАНИЦА «ЛУКИ»
 *
 * Что входит:
 * 1) Загрузка сохранённых луков из localStorage (поддерживаются разные ключи: 'wardrobe_looks', 'looks', 'outfits').
 * 2) Просмотр каждого лука в модальном окне с переключением Фото ⇄ Коллаж.
 * 3) Лайки и комментарии (мета хранится в 'looks_meta', привязка по id).
 * 4) Удаление луков (сразу из всех поддерживаемых ключей на всякий случай).
 * 5) Акуратная верстка на Tailwind, вид как в списке и быстрая карточка-превью.
 * 6) Кнопка «+ Створити» ведёт на страницу конструктора (замените href на ваш роут, например "/zibraty-luk").
 *
 * Ожидаемая структура лука в storage (гибкая, поля необязательны):
 * {
 *   id: string,               // обязательный
 *   title?: string,
 *   createdAt?: string|number,
 *   collageDataUrl?: string,  // base64 PNG/JPG коллажа
 *   photoDataUrl?: string     // base64 исходного фото
 * }
 */

const STORAGE_KEYS = ["wardrobe_looks", "looks", "outfits"]; // читаем откуда угодно
const META_KEY = "looks_meta"; // { [id]: { likes: number, liked: boolean, comments: [{id, text, date}] } }

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("Bad JSON in", key, e);
    return null;
  }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function normalizeLook(obj, sourceKey) {
  if (!obj) return null;
  const id = obj.id ?? obj._id ?? obj.uid ?? `${sourceKey}-${Math.random().toString(36).slice(2)}`;
  const title = obj.title || obj.name || "Без назви";
  const createdAt = obj.createdAt || obj.date || Date.now();
  const collageDataUrl = obj.collageDataUrl || obj.collage || obj.canvasImage || obj.preview;
  const photoDataUrl = obj.photoDataUrl || obj.photo || obj.basePhoto;
  return { id, title, createdAt, collageDataUrl, photoDataUrl, _sourceKey: sourceKey };
}

const EmptyState = () => (
  <div className="w-full max-w-2xl mx-auto text-center py-20">
    <div className="w-14 h-14 mx-auto rounded-2xl shadow flex items-center justify-center mb-4">
      <Layers className="w-7 h-7" />
    </div>
    <h3 className="text-xl font-semibold mb-2">Ще немає жодного лука</h3>
    <p className="text-sm text-gray-500 mb-6">Створіть перший образ у конструкторі та збережіть його — він з'явиться тут.</p>
    <a href="/compose" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl shadow hover:shadow-md transition border bg-white">
      <Plus className="w-4 h-4" />
      <span>Створити</span>
    </a>
  </div>
);

export default function LooksPage() {
  const [looks, setLooks] = useState([]);
  const [meta, setMeta] = useState({});
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null); // текущий лук в модалке
  const [viewMode, setViewMode] = useState("collage"); // collage | photo в модалке

  // Загрузка
  useEffect(() => {
    const loaded = [];
    for (const key of STORAGE_KEYS) {
      const arr = readJSON(key);
      if (Array.isArray(arr)) {
        arr.forEach(item => {
          const norm = normalizeLook(item, key);
          if (norm) loaded.push(norm);
        });
      }
    }
    // дедуп по id, оставляем самый свежий createdAt
    const byId = new Map();
    loaded.forEach(l => {
      const exist = byId.get(l.id);
      if (!exist || (l.createdAt || 0) > (exist.createdAt || 0)) byId.set(l.id, l);
    });
    const list = Array.from(byId.values()).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    setLooks(list);

    const m = readJSON(META_KEY) || {};
    setMeta(m);
  }, []);

  // Сохранение метаданных
  const saveMeta = (next) => {
    setMeta(next);
    writeJSON(META_KEY, next);
  };

  // Удаление из всех возможных ключей
  const deleteLookEverywhere = (id) => {
    for (const key of STORAGE_KEYS) {
      const arr = readJSON(key);
      if (Array.isArray(arr)) {
        const filtered = arr.filter(it => (it.id || it._id || it.uid) !== id);
        writeJSON(key, filtered);
      }
    }
  };

  const onDelete = (id) => {
    if (!confirm("Видалити лук назавжди?")) return;
    deleteLookEverywhere(id);
    setLooks(prev => prev.filter(l => l.id !== id));
    const nextMeta = {...meta};
    delete nextMeta[id];
    saveMeta(nextMeta);
  };

  const onToggleLike = (id) => {
    const m = meta[id] || { likes: 0, liked: false, comments: [] };
    const liked = !m.liked;
    const likes = Math.max(0, (m.likes || 0) + (liked ? 1 : -1));
    saveMeta({ ...meta, [id]: { ...m, liked, likes } });
  };

  const onAddComment = (id, text) => {
    const t = text.trim();
    if (!t) return;
    const m = meta[id] || { likes: 0, liked: false, comments: [] };
    const next = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: t, date: Date.now() };
    saveMeta({ ...meta, [id]: { ...m, comments: [...(m.comments||[]), next] } });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return looks;
    return looks.filter(l => (l.title||"").toLowerCase().includes(q));
  }, [looks, query]);

  const openModal = (look, initial = "collage") => {
    setActive(look);
    setViewMode(initial);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Мої образи</h1>
        <a href="/zibraty-luk" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border bg-white shadow hover:shadow-md transition">
          <Plus className="w-4 h-4" />
          <span>Створити</span>
        </a>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Пошук за назвою…"
          className="w-full sm:w-80 px-4 py-2 rounded-2xl border focus:outline-none focus:ring-2"
        />
        <span className="text-sm text-gray-500">Всього: {filtered.length}</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {filtered.map(look => {
            const m = meta[look.id] || { likes: 0, liked: false, comments: [] };
            const preview = look.collageDataUrl || look.photoDataUrl;
            const date = new Date(Number(look.createdAt || Date.now()));
            return (
              <li key={look.id} className="rounded-2xl border bg-white shadow-sm hover:shadow-md transition">
                <div className="p-4 sm:p-5 flex flex-col gap-3">
                  {/* Row 1: title + actions */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-medium leading-tight">{look.title || "Без назви"}</h3>
                      <div className="text-xs text-gray-500 mt-0.5">Опубліковано • {date.toLocaleDateString()} {date.toLocaleTimeString()}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={()=>onToggleLike(look.id)} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border transition ${m.liked ? 'bg-rose-50 border-rose-200' : 'bg-white'}`}>
                        <Heart className={`w-4 h-4 ${m.liked ? 'fill-current' : ''}`} />
                        <span className="text-sm">{m.likes||0}</span>
                      </button>
                      <button onClick={()=>openModal(look, look.collageDataUrl ? 'collage' : 'photo')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border bg-white">
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-sm">Переглянути</span>
                      </button>
                      <button onClick={()=>onDelete(look.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border bg-white text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm">Видалити</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: preview + quick actions */}
                  {preview && (
                    <div className="flex items-center gap-4">
                      <div className="w-28 h-28 sm:w-36 sm:h-36 overflow-hidden rounded-xl border">
                        {/* уменьшенный превью */}
                        <img src={preview} alt="preview" className="w-full h-full object-cover"/>
                      </div>
                      <div className="flex-1 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                        {look.photoDataUrl && (
                          <button onClick={()=>openModal(look, 'photo')} className="px-3 py-1.5 rounded-xl border bg-white inline-flex items-center gap-2">
                            <ImageIcon className="w-4 h-4"/>
                            Фото
                          </button>
                        )}
                        {look.collageDataUrl && (
                          <button onClick={()=>openModal(look, 'collage')} className="px-3 py-1.5 rounded-xl border bg-white inline-flex items-center gap-2">
                            <Layers className="w-4 h-4"/>
                            Колаж
                          </button>
                        )}
                        <button onClick={()=>document.getElementById(`cmnts-${look.id}`)?.focus()} className="px-3 py-1.5 rounded-xl border bg-white inline-flex items-center gap-2">
                          <MessageSquareText className="w-4 h-4"/>
                          Коментарі ({m.comments?.length||0})
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Row 3: comments */}
                  <div className="mt-1 space-y-2">
                    <div className="max-h-44 overflow-y-auto pr-1 space-y-2">
                      {(m.comments||[]).map(c => (
                        <div key={c.id} className="text-sm px-3 py-2 rounded-xl bg-gray-50 border">
                          <div className="text-[11px] text-gray-500 mb-1">{new Date(c.date).toLocaleString()}</div>
                          <div className="whitespace-pre-wrap">{c.text}</div>
                        </div>
                      ))}
                    </div>
                    <CommentBox lookId={look.id} onAdd={onAddComment} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal */}
      {active && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setActive(null)} />
          <div className="absolute inset-0 p-4 flex items-center justify-center">
            <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=>setViewMode('photo')}
                    className={`px-3 py-1.5 rounded-xl border text-sm ${viewMode==='photo' ? 'bg-gray-100' : 'bg-white'}`}
                    disabled={!active.photoDataUrl}
                  >Фото</button>
                  <button
                    onClick={()=>setViewMode('collage')}
                    className={`px-3 py-1.5 rounded-xl border text-sm ${viewMode==='collage' ? 'bg-gray-100' : 'bg-white'}`}
                    disabled={!active.collageDataUrl}
                  >Колаж</button>
                </div>
                <button onClick={()=>setActive(null)} className="p-2 rounded-xl border bg-white">
                  <X className="w-4 h-4"/>
                </button>
              </div>

              <div className="p-4 sm:p-6">
                <div className="w-full mx-auto rounded-xl overflow-hidden border">
                  {viewMode === 'photo' && active.photoDataUrl && (
                    <img src={active.photoDataUrl} alt="Фото" className="w-full h-auto object-contain max-h-[75vh]" />
                  )}
                  {viewMode === 'collage' && active.collageDataUrl && (
                    <img src={active.collageDataUrl} alt="Колаж" className="w-full h-auto object-contain max-h-[75vh]" />
                  )}
                  {!active.photoDataUrl && !active.collageDataUrl && (
                    <div className="p-8 text-center text-sm text-gray-500">Немає зображення для відображення</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentBox({ lookId, onAdd }) {
  const [val, setVal] = useState("");
  const submit = (e) => {
    e.preventDefault();
    onAdd(lookId, val);
    setVal("");
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        id={`cmnts-${lookId}`}
        value={val}
        onChange={e=>setVal(e.target.value)}
        placeholder="Залишити коментар…"
        className="flex-1 px-4 py-2 rounded-2xl border focus:outline-none focus:ring-2"
      />
      <button type="submit" className="px-3 py-2 rounded-2xl border bg-white shadow hover:shadow-md transition">Надіслати</button>
    </form>
  );
}
