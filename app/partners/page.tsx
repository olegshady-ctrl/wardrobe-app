"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Product = { id: string; brand: string|null; title: string; category: string; price: number|null; currency: string|null; image_url: string|null; product_url: string; store_name: string|null; city: string|null; };

const CATS = ["ALL","TOP","BOTTOM","SHOES","OUTERWEAR","ACCESSORY","DRESS"] as const;

export default function PartnersPage(){
  const [cat, setCat] = useState<(typeof CATS)[number]>("ALL");
  const [list, setList] = useState<Product[]>([]);

  useEffect(()=>{ load(); }, [cat]);
  async function load(){
    const q = supabase.from("partner_products")
      .select("id,brand,title,category,price,currency,image_url,product_url,store_name,city")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(48);
    const { data } = cat==="ALL" ? await q : await q.eq("category", cat);
    setList((data ?? []) as Product[]);
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Магазины</h1>
      <select className="border p-2 rounded" value={cat} onChange={e=>setCat(e.target.value as any)}>
        {CATS.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {list.map(p => (
          <a key={p.id} href={p.product_url} target="_blank" rel="noopener noreferrer"
             className="border rounded-lg overflow-hidden hover:shadow">
            {p.image_url && <img src={p.image_url} alt={p.title} className="w-full aspect-square object-cover" />}
            <div className="p-2 text-sm">
              <div className="font-medium">{p.title}</div>
              <div className="text-gray-600">{p.brand || p.store_name}</div>
              {p.price!=null && <div className="mt-1">{p.price} {p.currency || "UAH"}</div>}
              <div className="mt-1 text-xs text-gray-500">{p.category} · {p.city || ""}</div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
