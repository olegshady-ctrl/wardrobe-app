"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getLocalUserId } from "@/lib/localUser";

type WardrobeItem = { id: string; category: string | null; };
type Product = {
  id: string; brand: string | null; title: string;
  category: string; price: number | null; currency: string | null;
  image_url: string | null; product_url: string;
  store_name: string | null; city: string | null;
};

const ALL = ["TOP","BOTTOM","SHOES","OUTERWEAR","ACCESSORY","DRESS"] as const;

export default function RecommendationsPage() {
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const uid = getLocalUserId();
      const w = await supabase
        .from("wardrobe_items")
        .select("id,category")
        .eq("user_id", uid);
      const items = (w.data ?? []) as WardrobeItem[];

      // какие категории у тебя уже есть
      const have = new Set(items.map(i => i.category || "").filter(Boolean));
      // правило для MVP: хотим базовый набор (top+bottom+shoes+outerwear)
      const want = ["TOP","BOTTOM","SHOES","OUTERWEAR"];
      const missing = want.filter(c => !have.has(c));

      // если всё есть — просто покажем новинки по категориям, где у тебя меньше всего
      const need = (missing.length ? missing : ALL.slice(0, 4));

      const p = await supabase
        .from("partner_products")
        .select("id,brand,title,category,price,currency,image_url,product_url,store_name,city")
        .in("category", need)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(24);

      setWardrobe(items);
      setProducts((p.data ?? []) as Product[]);
      setLoading(false);
    })();
  }, []);

  const haveCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of ALL) m[c] = 0;
    for (const it of wardrobe) if (it.category) m[it.category] = (m[it.category] ?? 0) + 1;
    return m;
  }, [wardrobe]);

  if (loading) return <main className="p-4">Загружаем рекомендации…</main>;

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Рекомендации</h1>

      <div className="text-sm text-gray-600">
        Баланс гардероба:&nbsp;
        {ALL.map(c => (
          <span key={c} className="mr-2">{c}:{haveCounts[c]}</span>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {products.map(p => (
          <a
            key={p.id}
            href={withUtm(p.product_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="border rounded-lg overflow-hidden hover:shadow"
          >
            {p.image_url && (
              <img src={p.image_url} alt={p.title} className="w-full aspect-square object-cover" />
            )}
            <div className="p-2 text-sm">
              <div className="font-medium">{p.title}</div>
              <div className="text-gray-600">{p.brand || p.store_name}</div>
              {p.price != null && (
                <div className="mt-1">{p.price} {p.currency || "UAH"}</div>
              )}
              <div className="mt-1 text-xs text-gray-500">{p.category} · {p.city || "Одесса"}</div>
              <div className="mt-2 inline-block text-blue-600">Купить →</div>
            </div>
          </a>
        ))}
      </div>

      {products.length === 0 && (
        <p className="text-sm text-gray-500">Пока нет предложений — добавь партнёрские товары.</p>
      )}
    </main>
  );
}

function withUtm(url: string) {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "wardrobe-mvp");
    u.searchParams.set("utm_medium", "app");
    u.searchParams.set("utm_campaign", "reco");
    return u.toString();
  } catch { return url; }
}
