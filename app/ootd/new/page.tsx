"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Stage, Layer, Image as KImage, Transformer } from "react-konva";
import useImage from "use-image";
import { supabase } from "@/lib/supabaseClient";
import { useUserId } from "@/lib/useUserId";
import { uploadToCloudinary } from "@/lib/cloudinaryUpload";
import { CATEGORY_UA } from "@/lib/t";

type WardrobeItem = { id: string; image_url: string | null; title: string | null; category: keyof typeof CATEGORY_UA | null; };
type CanvasItem = { id: string; src: string; x: number; y: number; scale: number; rotation: number; };

const W = 1080, H = 1350;

/* ---------- Елемент з трансформером ---------- */
function URLImage({
  shape, isSelected, onSelect, onChange,
}: {
  shape: CanvasItem; isSelected: boolean; onSelect: () => void;
  onChange: (next: CanvasItem) => void;
}) {
  const [img] = useImage(shape.src, "anonymous");
  const ref = useRef<any>(null), tr = useRef<any>(null);

  useEffect(() => { if (isSelected && tr.current && ref.current) { tr.current.nodes([ref.current]); tr.current.getLayer()?.batchDraw(); } }, [isSelected]);

  return <>
    <KImage
      ref={ref} image={img}
      x={shape.x} y={shape.y} scaleX={shape.scale} scaleY={shape.scale} rotation={shape.rotation}
      draggable onClick={onSelect} onTap={onSelect}
      onDragEnd={e => onChange({ ...shape, x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const n = ref.current;
        const next = { ...shape, x: n.x(), y: n.y(), rotation: n.rotation(), scale: n.scaleX() };
        n.scaleX(1); n.scaleY(1);
        onChange(next);
      }}
    />
    {isSelected && <Transformer ref={tr} rotateEnabled anchorSize={10} borderDash={[6,4]}
      enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]} />}
  </>;
}

/* ---------- Канва колажу з хендлом toDataURL ---------- */
export type CollageHandle = { toDataURL: (ratio?: number) => string };
const Collage = forwardRef<CollageHandle, {
  items: CanvasItem[], setItems: (arr: CanvasItem[]) => void, selectedId: string | null, setSelectedId: (id: string | null) => void
}>(({ items, setItems, selectedId, setSelectedId }, ref) => {
  const stage = useRef<any>(null);
  const [scale, setScale] = useState(1);
  const container = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => ({
    toDataURL: (ratio = 2) => stage.current?.toDataURL({ pixelRatio: ratio, mimeType: "image/png" }),
  }), []);

  useEffect(() => {
    const fit = () => { if (!container.current) return; setScale(container.current.clientWidth / W); };
    fit(); addEventListener("resize", fit); return () => removeEventListener("resize", fit);
  }, []);

  return (
    <div ref={container} className="w-full">
      <Stage ref={stage} width={W} height={H} scaleX={scale} scaleY={scale}
        onMouseDown={e => { if (e.target === e.target.getStage()) setSelectedId(null); }}>
        <Layer>
          {items.map(it => (
            <URLImage key={it.id} shape={it}
              isSelected={selectedId === it.id}
              onSelect={() => setSelectedId(it.id)}
              onChange={(next) => setItems(items.map(x => x.id === it.id ? next : x))}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
});
Collage.displayName = "Collage";

/* ---------- Сторінка OOTD ---------- */
export default function OOTDNewPage() {
  const userId = useUserId();
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [primaryIsPhoto, setPrimaryIsPhoto] = useState(true);
  const collageRef = useRef<CollageHandle>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("wardrobe_items")
        .select("id,image_url,title,category")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setWardrobe((data ?? []) as WardrobeItem[]);
    })();
  }, [userId]);

  const addItem = (w: WardrobeItem) => {
    if (!w.image_url) return;
    setItems(prev => [...prev, {
      id: `${w.id}-${Date.now()}`, src: w.image_url, x: 200 + Math.random()*100, y: 200 + Math.random()*100, scale: 1, rotation: 0
    }]);
  };

  const onPickPhoto = (f: File | null) => {
    setPhoto(f || null);
    setPhotoUrl(f ? URL.createObjectURL(f) : "");
  };

  async function save() {
    if (!userId) return;
    if (!photo && items.length === 0) return alert("Додайте фото або предмети на колаж");
    try {
      const collageDataUrl = collageRef.current?.toDataURL(2) ?? "";
      const collageUrl = collageDataUrl ? await uploadToCloudinary(collageDataUrl) : "";
      const photoUploaded = photo ? await uploadToCloudinary(photo) : "";

      await supabase.from("ootd_posts").insert({
        user_id: userId,
        photo_url: photoUploaded || photoUrl,
        collage_url: collageUrl,
        items_json: items,
        is_published: true,
      });

      alert("Готово ✅"); history.back();
    } catch (e: any) {
      alert("Не вдалось зберегти: " + (e?.message || ""));
    }
  }

  return (
    <main className="pb-28">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <button onClick={() => history.back()} className="text-lg">✕</button>
        <div className="font-semibold">Outfits of the day</div>
        <button onClick={save} className="px-4 py-2 rounded bg-black text-white">Зберегти</button>
      </div>

      {/* Головна зона: фото або колаж, з мініатюрою у кутку */}
      <div className="p-3">
        <div className="relative rounded-2xl overflow-hidden bg-neutral-50 border">
          {/* primary */}
          <div className="w-full">
            {primaryIsPhoto ? (
              photoUrl ? <img src={photoUrl} className="w-full h-auto" /> :
              <div className="aspect-[4/5] flex items-center justify-center gap-2 text-sm text-gray-500">
                <label className="cursor-pointer px-3 py-2 border rounded bg-white shadow-sm">
                  Обрати фото
                  <input type="file" accept="image/*" className="hidden" onChange={(e)=>onPickPhoto(e.target.files?.[0]||null)} />
                </label>
              </div>
            ) : (
              <Collage ref={collageRef} items={items} setItems={setItems} selectedId={sel} setSelectedId={setSel}/>
            )}
          </div>

          {/* secondary thumbnail (перемикач) */}
          <button
            onClick={() => setPrimaryIsPhoto(p => !p)}
            className="absolute bottom-3 right-3 w-28 h-28 border rounded-xl overflow-hidden bg-white/80 backdrop-blur shadow"
            title="Поміняти місцями"
          >
            {primaryIsPhoto ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                {/* показуємо міні-колаж (скріншот) */}
                {items.length ? <img src={collageRef.current?.toDataURL(0.5)} className="w-full h-full object-cover" /> : "Колаж"}
              </div>
            ) : (
              photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : <div className="text-xs p-1">Фото</div>
            )}
          </button>
        </div>
      </div>

      {/* Карусель речей */}
      <div className="fixed left-0 right-0 bottom-0 bg-white border-t">
        <div className="p-3 font-medium">Додати предмет</div>
        <div className="px-3 pb-4 overflow-x-auto">
          <div className="flex gap-3">
            <label className="shrink-0 w-24 h-24 border rounded-lg flex items-center justify-center text-xs text-gray-600 cursor-pointer">
              Фото
              <input type="file" accept="image/*" className="hidden" onChange={(e)=>onPickPhoto(e.target.files?.[0]||null)} />
            </label>
            {wardrobe.map(w => (
              <button key={w.id} onClick={()=>addItem(w)} className="shrink-0 w-24 h-24 border rounded-lg overflow-hidden bg-white">
                {w.image_url && <img src={w.image_url} className="w-full h-full object-cover" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
