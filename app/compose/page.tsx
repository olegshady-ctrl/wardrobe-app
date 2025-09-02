'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import html2canvas from 'html2canvas';

type CollageItem = {
  id: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  scale: number;
  z: number;
  name?: string;
};

type WardrobeItem = { id: string; src: string; name?: string; kind?: string };

const KINDS = ['Верхній одяг', 'Топи', 'Низ', 'Взуття', 'Аксесуари', 'Купальники', 'Інше'];

/** Базовая ширина макета (ограничитель) */
const BASE_W = 1024;

/* ---------- helpers: dataURL/сжатие/проверки ---------- */
const blobToDataURL = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('read blob fail'));
    r.onloadend = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });

const urlToDataURL = async (url: string) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return blobToDataURL(blob);
};

const isBlobLike = (s?: string | null) => !!s && s.startsWith('blob:');

// Настройки экспорта
const EXPORT_MAX_W = 1080;
const EXPORT_MAX_H = 1920;
const EXPORT_QUALITY = 0.82;       // 0..1
const EXPORT_MIME = 'image/jpeg';  // JPEG меньше PNG

// Canvas -> dataURL c ограничением размеров/качества
function canvasToResizedDataUrl(
  src: HTMLCanvasElement,
  maxW = EXPORT_MAX_W,
  maxH = EXPORT_MAX_H,
  mime = EXPORT_MIME,
  quality = EXPORT_QUALITY
) {
  const w0 = src.width;
  const h0 = src.height;
  const k = Math.min(maxW / w0, maxH / h0, 1);
  const w = Math.round(w0 * k);
  const h = Math.round(h0 * k);
  if (k === 1) return src.toDataURL(mime, quality);

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0, w, h);
  return c.toDataURL(mime, quality);
}

// Уменьшить картинку по URL до JPEG (для элементов при необходимости)
async function imageUrlToJpegDataUrl(
  url: string,
  maxW = 800,
  maxH = 800,
  quality = 0.82
) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  if (isBlobLike(url)) {
    const blob = await (await fetch(url)).blob();
    url = URL.createObjectURL(blob);
  }
  img.src = url;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('image load failed'));
  });
  const k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  const out = c.toDataURL('image/jpeg', quality);
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  return out;
}
/* ------------------------------------------------------ */

// Полотно 9×16 (адаптивное): ширина задаётся извне
const Stage9x16 = ({
  children,
  width,
  stageRef,
}: {
  children: React.ReactNode;
  width: number;
  stageRef: React.RefObject<HTMLDivElement>;
}) => {
  return (
    <div
      ref={stageRef}
      className="relative rounded-2xl border border-zinc-200 bg-white/70 shadow-sm mx-auto overflow-hidden"
      style={{ width, aspectRatio: '9 / 16' }}
    >
      <div className="absolute inset-0">{children}</div>
    </div>
  );
};

export default function Page() {
  const [mode, setMode] = useState<'collage' | 'photo'>('collage');

  // Подпись (как в Instagram)
  const [title, setTitle] = useState('');
  const captionRef = useRef<HTMLTextAreaElement | null>(null);

  // Фото
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoScale, setPhotoScale] = useState(1);
  const [photoRot, setPhotoRot] = useState(0);

  // Контейнеры
  const collageRef = useRef<HTMLDivElement | null>(null);
  const photoRef = useRef<HTMLDivElement | null>(null);

  const [bg, setBg] = useState('#f8fafc');
  const [items, setItems] = useState<CollageItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const maxZ = useMemo(() => (items.length ? Math.max(...items.map((i) => i.z)) : 0), [items]);

  // Гардероб
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [kindFilter, setKindFilter] = useState<string>('Усі');
  const reloadWardrobe = () => {
    const saved = localStorage.getItem('wardrobe_items');
    setWardrobe(saved ? JSON.parse(saved) : []);
  };
  useEffect(reloadWardrobe, []);

  // ---------- адаптивная ширина полотна + синхронная ширина подписи ----------
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [stageW, setStageW] = useState<number>(360);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // оставим отступы, ограничим максималку
      const w = Math.min(el.clientWidth - 16 /*padding*/, 640, BASE_W);
      setStageW(Math.max(280, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // ---------------------------------------------------------------------------

  // Свайп между вкладками (горизонтальный)
  const stageRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let touching = false;

    const onStart = (e: TouchEvent) => {
      touching = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (!touching) return;
      touching = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0 && mode === 'photo') setMode('collage');
        if (dx > 0 && mode === 'collage') setMode('photo');
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [mode]);

  const addFromWardrobe = (w: WardrobeItem) => {
    setItems((prev) => [
      ...prev,
      {
        id: `from-${w.id}-${Date.now()}`,
        src: w.src,
        x: 60 + prev.length * 12,
        y: 60 + prev.length * 12,
        w: 220,
        h: 220,
        rot: 0,
        scale: 1,
        z: maxZ + 1,
        name: w.name,
      },
    ]);
    setMode('collage');
  };

  const onAddClothesFilesToCollage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = e.target.files;
    if (!fs?.length) return;
    const next: CollageItem[] = [];
    Array.from(fs).forEach((f, idx) =>
      next.push({
        id: `u-${Date.now()}-${idx}`,
        src: URL.createObjectURL(f),
        x: 40 + idx * 20,
        y: 40 + idx * 20,
        w: 180,
        h: 180,
        rot: 0,
        scale: 1,
        z: maxZ + 1 + idx,
      })
    );
    setItems((prev) => [...prev, ...next]);
    setMode('collage');
  };

  // Фото: камера/галерея
  const camInputRef = useRef<HTMLInputElement | null>(null);
  const galInputRef = useRef<HTMLInputElement | null>(null);

  const onPickPhotoCamera = () => camInputRef.current?.click();
  const onPickPhotoGallery = () => galInputRef.current?.click();

  const onPickFileCommon: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoUrl(URL.createObjectURL(f));
    setMode('photo');
  };

  const onDelete = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const removeBg = async (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    try {
      const resp = await fetch(it.src);
      const blob = await resp.blob();
      const fd = new FormData();
      fd.append('image', new File([blob], 'item.png', { type: blob.type || 'image/png' }));
      const cut = await fetch('/api/remove-bg', { method: 'POST', body: fd });
      if (!cut.ok) throw new Error(await cut.text());
      const out = await cut.blob();
      const url = URL.createObjectURL(out);
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, src: url } : p)));
    } catch (e) {
      console.error(e);
      alert('Фон не видалено. Переконайся, що додано REMOVE_BG_API_KEY і створено файл app/api/remove-bg/route.ts');
    }
  };

  // Сохранение (работает из любого режима; фото сохраняется с трансформациями)
  const saveLook = async () => {
    setIsRendering(true);
    setActiveId(null);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    // 1) Экспорт коллажа
    let collageDataUrl: string | undefined;
    if (collageRef.current) {
      const cnv = await html2canvas(collageRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        ignoreElements: (el) => el.classList?.contains('no-export'),
      });
      collageDataUrl = canvasToResizedDataUrl(cnv);
    }

    // 2) Экспорт слоя Фото с учётом трансформаций
    let photoDataUrl: string | undefined;
    if (photoUrl && photoRef.current) {
      const pCanvas = await html2canvas(photoRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      photoDataUrl = canvasToResizedDataUrl(pCanvas);
    } else if (photoUrl) {
      photoDataUrl = isBlobLike(photoUrl) ? await urlToDataURL(photoUrl) : photoUrl;
    }

    // 3) Элементи -> dataURL (если blob:, сжимаем до JPEG ~800px)
    const elements = await Promise.all(
      items.map(async (it) => {
        try {
          let src = it.src;
          if (isBlobLike(src)) {
            src = await imageUrlToJpegDataUrl(src, 800, 800, 0.82);
          }
          return { id: it.id, src, name: it.name };
        } catch {
          return { id: it.id, src: it.src, name: it.name };
        }
      })
    );

    setIsRendering(false);

    const entry = {
      id: `look-${Date.now()}`,
      title: title.trim() || 'Без назви',
      createdAt: Date.now(),
      collageDataUrl,
      photoDataUrl,
      elements,
    };

    const key = 'wardrobe_looks';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');

    try {
      localStorage.setItem(key, JSON.stringify([entry, ...prev]));
      alert('Лук збережено! Перейдіть у розділ «Луки».');
    } catch (e) {
      console.error(e);
      alert(
        'Не вдалося зберегти: бракує місця у сховищі браузера.\n' +
          'Видаліть кілька старих луків або зменште розмір зображень.'
      );
    }
  };

  // Экспорт PNG текущего вида (фото/колаж)
  const exportPng = async () => {
    const target = mode === 'photo' ? photoRef.current : collageRef.current;
    if (!target) return;
    setIsRendering(true);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const cnv = await html2canvas(target, {
      backgroundColor: mode === 'photo' ? '#ffffff' : null,
      scale: 2,
      useCORS: true,
      ignoreElements: (el) => el.classList?.contains('no-export'),
    });
    setIsRendering(false);
    const dataUrl = cnv.toDataURL('image/png');
    // скачать
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `look-${mode}.png`;
    a.click();
  };

  // Авто-resize подписи
  useEffect(() => {
    const el = captionRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = el.scrollHeight + 'px';
  }, [title]);

  return (
    <div ref={wrapRef} className="max-w-6xl mx-auto p-4">
      <h1 className="text-xl font-semibold">Зібрати образ</h1>

      {/* ПОЛОТНО 9×16 — рендерим ОДНОВРЕМЕННО оба слоя, скрывая неактивный; свайпает по stageRef */}
      <Stage9x16 width={stageW} stageRef={stageRef}>
        {/* Колаж (всегда в DOM) */}
        <div
          ref={collageRef}
          className={`absolute inset-0 ${mode === 'collage' ? 'block' : 'hidden'}`}
          style={{ background: bg }}
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setActiveId(null);
          }}
        >
          {items.map((it) => (
            <Rnd
              key={it.id}
              size={{ width: it.w, height: it.h }}
              position={{ x: it.x, y: it.y }}
              onDragStop={(_, d) =>
                setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, x: d.x, y: d.y } : p)))
              }
              onResizeStop={(_, __, ref, ___, pos) =>
                setItems((prev) =>
                  prev.map((p) =>
                    p.id === it.id
                      ? { ...p, w: ref.offsetWidth, h: ref.offsetHeight, x: pos.x, y: pos.y }
                      : p
                  )
                )
              }
              bounds="parent"
              style={{ zIndex: it.z }}
              onMouseDown={() => !isRendering && setActiveId(it.id)}
            >
              <div
                className={`relative w-full h-full select-none ${
                  !isRendering && activeId === it.id ? 'ring-2 ring-zinc-900 no-export' : ''
                }`}
              >
                <div
                  className="absolute inset-0"
                  style={{ transform: `rotate(${it.rot}deg) scale(${it.scale})`, transformOrigin: 'center' }}
                >
                  <img
                    src={it.src}
                    alt={it.name || 'item'}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                </div>

                {/* оверлеи управления — no-export */}
                {!isRendering && activeId === it.id && (
                  <>
                    <div className="absolute -top-9 left-0 flex gap-1 no-export">
                      <button
                        onClick={() => removeBg(it.id)}
                        className="text-[11px] px-2 py-0.5 bg-white/90 border border-teal-400 text-teal-700 rounded"
                        title="Видалити фон"
                      >
                        ⧉
                      </button>
                      <button
                        onClick={() => onDelete(it.id)}
                        className="text-[11px] px-2 py-0.5 bg-white/90 border border-red-300 text-red-600 rounded"
                        title="Видалити"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-44 space-y-1 no-export">
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        value={it.rot}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((p) => (p.id === it.id ? { ...p, rot: +e.target.value } : p))
                          )
                        }
                        className="w-full"
                        title="Обертання"
                      />
                      <input
                        type="range"
                        min={50}
                        max={200}
                        value={Math.round(it.scale * 100)}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((p) =>
                              p.id === it.id ? { ...p, scale: +e.target.value / 100 } : p
                            )
                          )
                        }
                        className="w-full"
                        title="Масштаб"
                      />
                    </div>
                  </>
                )}
              </div>
            </Rnd>
          ))}
        </div>

        {/* Фото (всегда в DOM) */}
        <div ref={photoRef} className={`absolute inset-0 ${mode === 'photo' ? 'block' : 'hidden'} bg-white`}>
          {!photoUrl ? (
            <div className="absolute inset-0 grid place-items-center text-center p-4">
              <div className="space-y-3">
                <div className="text-zinc-600">Додайте фото</div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={onPickPhotoCamera}
                    className="px-3 py-2 rounded-lg border border-zinc-300 bg-white"
                  >
                    З камери
                  </button>
                  <button
                    onClick={onPickPhotoGallery}
                    className="px-3 py-2 rounded-lg border border-zinc-300 bg-white"
                  >
                    З галереї
                  </button>
                </div>
                {/* hidden inputs */}
                <input
                  ref={camInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onPickFileCommon}
                />
                <input
                  ref={galInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickFileCommon}
                />
                <div className="text-xs text-zinc-500">Свайп вправо/влево — перемикання Фото/Колаж</div>
              </div>
            </div>
          ) : (
            <img
              src={photoUrl}
              alt="Фото"
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                objectFit: 'contain',
                transform: `rotate(${photoRot}deg) scale(${photoScale})`,
                transformOrigin: 'center',
                willChange: 'transform',
              }}
            />
          )}
        </div>
      </Stage9x16>

      {/* Подпись под полотном */}
      <div className="mt-3 mb-1 mx-auto" style={{ width: stageW }}>
        <textarea
          ref={captionRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Підпис/опис до лука…"
          className="w-full px-4 py-3 rounded-2xl border text-base bg-white placeholder:text-zinc-400 resize-none overflow-hidden min-h-[72px] max-h-[240px]"
        />
      </div>

      {/* Нижняя панель */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-zinc-300 overflow-hidden">
          <button
            onClick={() => setMode('collage')}
            className={`px-3 py-1 text-sm ${mode === 'collage' ? 'bg-zinc-900 text-white' : 'bg-white'}`}
          >
            Колаж
          </button>
          <button
            onClick={() => setMode('photo')}
            className={`px-3 py-1 text-sm ${mode === 'photo' ? 'bg-zinc-900 text-white' : 'bg-white'}`}
          >
            Фото
          </button>
        </div>

        {mode === 'collage' ? (
          <>
            <label className="text-sm">Колір/фон</label>
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 w-16" />
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="px-3 py-1.5 rounded-lg border border-zinc-300 bg-white">Додати елемент</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={onAddClothesFilesToCollage} />
            </label>
          </>
        ) : (
          photoUrl && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">Обертання</span>
                <input type="range" min={-180} max={180} value={photoRot} onChange={(e) => setPhotoRot(+e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Масштаб</span>
                <input
                  type="range"
                  min={50}
                  max={200}
                  value={Math.round(photoScale * 100)}
                  onChange={(e) => setPhotoScale(+e.target.value / 100)}
                />
              </div>
              <button
                onClick={() => {
                  setPhotoRot(0);
                  setPhotoScale(1);
                }}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 bg-white"
              >
                Скинути
              </button>
            </div>
          )
        )}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportPng} className="px-4 py-2 rounded-lg border border-zinc-300 bg-white">
            Експорт PNG
          </button>
          <button onClick={saveLook} className="px-4 py-2 rounded-lg bg-zinc-900 text-white shadow">
            Зберегти лук
          </button>
        </div>
      </div>

      {/* Мій гардероб */}
      <section className="mt-6 p-4 rounded-2xl border border-zinc-200 bg-white/70">
        <div className="flex items-center gap-3">
          <div className="font-semibold">Мій гардероб</div>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-2 py-1 rounded-md border border-zinc-300 text-sm"
          >
            <option>Усі</option>
            {KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <button onClick={reloadWardrobe} className="ml-auto px-2 py-1 rounded-md border border-zinc-300 text-sm">
            Оновити
          </button>
        </div>

        {wardrobe.length === 0 ? (
          <div className="text-sm text-zinc-500 mt-2">Поки порожньо — додайте речі у розділі «Гардероб»</div>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {wardrobe
              .filter((w) => kindFilter === 'Усі' || w.kind === kindFilter)
              .map((w) => (
                <button
                  key={w.id}
                  onClick={() => addFromWardrobe(w)}
                  className="group relative rounded-xl overflow-hidden border border-zinc-200 bg-white hover:shadow"
                >
                  <img src={w.src} alt={w.name || 'item'} className="w-full h-40 object-cover" />
                  <span className="absolute bottom-1 right-1 text-xs px-2 py-0.5 rounded bg-zinc-900/80 text-white">
                    Додати
                  </span>
                </button>
              ))}
          </div>
        )}
      </section>

      {mode === 'collage' && (
        <div className="mt-6 p-4 rounded-2xl border border-zinc-200 bg-white/70">
          <div className="font-semibold mb-2">Шари в колажі</div>
          <div className="flex gap-2 overflow-x-auto">
            {items.length === 0 && <div className="text-sm text-zinc-500">Поки порожньо — додайте речі</div>}
            {items
              .slice()
              .sort((a, b) => b.z - a.z)
              .map((it) => (
                <button
                  key={it.id}
                  onClick={() => setActiveId(it.id)}
                  className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border ${
                    activeId === it.id ? 'border-zinc-900' : 'border-zinc-200'
                  }`}
                >
                  <img src={it.src} alt={it.name || 'item'} className="w-full h-full object-cover" />
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
