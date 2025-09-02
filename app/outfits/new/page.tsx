"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserId } from "@/lib/useUserId";
import { CATEGORY_UA } from "@/lib/t";
import { useRouter } from "next/navigation";

type WardrobeItem = {
  id: string;
  title: string | null;
  category: keyof typeof CATEGORY_UA | null;
  image_url: string | null;
};

export default function NewOutfitPage() {
  const uid = useUserId();
  const router = useRouter();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data } = await supabase
        .from("wardrobe_items")
        .select("id,title,category,image_url")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      setItems((data ?? []) as any);
    })();
  }, [uid]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!uid) return;
    if (selected.size === 0) {
      alert("Оберіть хоча б одну річ");
      return;
    }
    setBusy(true);
    try {
      // 1) создаём look
      const { data: look, error } = await supabase
        .from("looks")
        .insert({
          user_id: uid,
          title: title || null,
          is_published: publish,
        })
        .select()
        .single();
      if (error) throw error;

      // 2) связываем вещи
      const rows = Array.from(selected).map((itemId, i) => ({
        look_id: look.id,
        item_id: itemId,
        position: i + 1,
      }));
      const { error: e2 } = await supabase.from("look_items").insert(rows);
      if (e2) throw e2;

      // 3) готово
      if (publish) router.replace(`/looks/${look.id}`);
      else router.replace(`/outfits`);
    } catch (e: any) {
      alert("Помилка збереження: " + (e?.message || "невідома"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-semibold">Новий образ</h1>

      <div className="grid gap-3 max-w-xl">
        <input
          className="border rounded p-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Назва образу (необов’язково)"
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
          />
          Опублікувати зараз
        </label>
      </div>

      <h2 className="font-medium">Оберіть речі з вашого гардеробу</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((it) => {
          const active = selected.has(it.id);
          return (
            <button
              key={it.id}
              onClick={() => toggle(it.id)}
              className={`border rounded overflow-hidden text-left ${active ? "ring-2 ring-black" : ""}`}
            >
              {it.image_url && (
                <img src={it.image_url} alt={it.title ?? ""} className="w-full aspect-square object-cover" />
              )}
              <div className="p-2 text-sm">
                <div className="font-medium truncate">{it.title || "Без назви"}</div>
                <div className="text-gray-500">{CATEGORY_UA[it.category || "TOP"]}</div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-60"
      >
        Зберегти
      </button>
    </main>
  );
}
