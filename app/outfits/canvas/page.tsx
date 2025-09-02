"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KImage, Transformer } from "react-konva";
import useImage from "use-image";
import { supabase } from "@/lib/supabaseClient";
import { useUserId } from "@/lib/useUserId";
import { uploadToCloudinary } from "@/lib/cloudinaryUpload";
import { t, CATEGORY_UA } from "@/lib/t";

type WardrobeItem = {
  id: string;
  title: string | null;
  category: keyof typeof CATEGORY_UA | null;
  image_url: string | null;
};

type CanvasItem = {
  id: string;      // id загруженной вещи
  src: string;     // url картинки
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

const CANVAS_W = 1080;   // під Instagram
const CANVAS_H = 1350;

function URLImage(props: {
  shape: CanvasItem;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (next: CanvasItem) => void;
}) {
  const { shape, isSelected, onSelect, onChange } = props;
  const [img] = useImage(shape.src, "anonymous");
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KImage
        ref={shapeRef}
        image={img}
        x={shape.x}
        y={shape.y}
        scaleX={shape.scale}
        scaleY={shape.scale}
        rotation={shape.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) =>
          onChange({ ...shape, x: e.target.x(), y: e.target.y() })
        }
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scale = node.scaleX(); // однаково X/Y
          const next: CanvasItem = {
            ...shape,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            scale: scale,
          };
          // важливо: повернути скейл ноди в 1, ми зберігаємо його у state
          node.scaleX(1);
          node.scaleY(1);
          onChange(next);
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ]}
          anchorSize={10}
          borderDash={[6, 4]}
        />
      )}
    </>
  );
}

export default function OutfitCanvasPage() {
  const userId = useUserId();
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // підганяємо масштаб під ширину екрана
  useEffect(() => {
    function fit() {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      setScale(w / CANVAS_W);
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // тягнемо речі з гардеробу
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("wardrobe_items")
        .select("id,title,category,image_url")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setWardrobe((data ?? []) as WardrobeItem[]);
    })();
  }, [userId]);

  const onAdd = (w: WardrobeItem) => {
    if (!w.image_url) return;
    const centerX = CANVAS_W / 2 - 200;
    const centerY = CANVAS_H / 2 - 200;
    setItems((prev) => [
      ...prev,
      {
        id: `${w.id}-${Date.now()}`,
        src: w.image_url!,
        x: centerX + Math.random() * 120 - 60,
        y: centerY + Math.random() * 120 - 60,
        scale: 1,
        rotation: 0,
      },
    ]);
  };

  const onChange = (id: string, next: CanvasItem) => {
    setItems((prev) => prev.map((it) => (it.id === id ? next : it)));
  };

  const onDeleteSelected = () => {
    if (!selectedId) return;
    setItems((prev) => prev.filter((it) => it.id !== selectedId));
    setSelectedId(null);
  };

  const onClear = () => {
    if (confirm("Очистити канву?")) {
      setItems([]);
      setSelectedId(null);
    }
  };

  const onSave = async () => {
    if (!userId || !stageRef.current) return;
    // 2x для кращої якості
    const dataUrl: string = stageRef.current.toDataURL({
      pixelRatio: 2,
      mimeType: "image/png",
    });

    try {
      const imageUrl = await uploadToCloudinary(dataUrl); // Cloudinary сприймає data URL як file
      const { error } = await supabase
        .from("looks")
        .insert({ user_id: userId, image_url: imageUrl, is_published: false });
      if (error) throw error;
      alert("Збережено ✅");
    } catch (e: any) {
      alert("Не вдалося зберегти: " + (e?.message || ""));
    }
  };

  return (
    <main className="p-0">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <button onClick={() => history.back()} className="text-lg">✕</button>
        <div className="font-semibold">Канва образу</div>
        <div className="w-6" />
      </div>

      <div ref={containerRef} className="px-2 pt-2">
        <div
          className="mx-auto border rounded-lg shadow-sm overflow-hidden"
          style={{ width: "100%", height: CANVAS_H * scale }}
        >
          <Stage
            ref={stageRef}
            width={CANVAS_W}
            height={CANVAS_H}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={(e) => {
              // клік по пустому місцю — зняти виділення
              const clickedOnEmpty =
                e.target === e.target.getStage();
              if (clickedOnEmpty) setSelectedId(null);
            }}
          >
            <Layer>
              {items.map((it) => (
                <URLImage
                  key={it.id}
                  shape={it}
                  isSelected={selectedId === it.id}
                  onSelect={() => setSelectedId(it.id)}
                  onChange={(next) => onChange(it.id, next)}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* тулбар */}
      <div className="sticky bottom-16 z-10 px-4 py-3 flex items-center gap-3 justify-center">
        <button
          onClick={onDeleteSelected}
          className="px-4 py-2 rounded bg-white border shadow-sm disabled:opacity-50"
          disabled={!selectedId}
        >
          Видалити вибране
        </button>
        <button
          onClick={onClear}
          className="px-4 py-2 rounded bg-white border shadow-sm"
        >
          Очистити
        </button>
        <button
          onClick={onSave}
          className="px-5 py-2 rounded bg-black text-white"
        >
          Зберегти
        </button>
      </div>

      {/* нижній шухляд з речами */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3">
        <div className="font-medium mb-2">Додати речі</div>
        {wardrobe.length === 0 ? (
          <div className="text-sm text-gray-500 px-1">
            У вашому гардеробі ще немає речей.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {wardrobe.map((w) => (
              <button
                key={w.id}
                onClick={() => onAdd(w)}
                className="border rounded overflow-hidden"
                title={w.title ?? CATEGORY_UA[w.category || "TOP"]}
              >
                {w.image_url && (
                  <img
                    src={w.image_url}
                    className="aspect-square object-cover w-full"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
