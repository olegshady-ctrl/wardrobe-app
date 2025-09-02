"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Shipping = { fullName: string; phone: string; country: string; city: string; address1: string; address2?: string; zip: string; };
type Payment  = { holder: string; last4: string; expMonth: string; expYear: string; };
type Sizing   = { gender: "male" | "female" | "other"; height: string; weight: string; chest: string; waist: string; hips: string; shoes: string; };
type Profile  = { nickname: string; firstName: string; lastName: string; city: string; avatarUrl: string; };

const LS_KEYS = {
  shipping: "settings.shipping",
  payment:  "settings.payment",
  sizing:   "settings.sizing",
  profile:  "settings.profile",
};

export default function SettingsPage() {
  const search = useSearchParams();
  const [open, setOpen] = useState<null | "shipping" | "payment" | "sizing" | "profile">(null);

  const [shipping, setShipping] = useState<Shipping>({ fullName:"", phone:"", country:"Україна", city:"", address1:"", address2:"", zip:"" });
  const [payment,  setPayment]  = useState<Payment>({ holder:"", last4:"", expMonth:"", expYear:"" });
  const [sizing,   setSizing]   = useState<Sizing>({ gender:"male", height:"", weight:"", chest:"", waist:"", hips:"", shoes:"" });
  const [profile,  setProfile]  = useState<Profile>({ nickname:"", firstName:"", lastName:"", city:"", avatarUrl:"" });

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<null | "shipping" | "payment" | "sizing" | "profile">(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.shipping) setShipping(data.shipping);
          if (data.payment)  setPayment(data.payment);
          if (data.sizing)   setSizing(data.sizing);
          if (data.profile)  setProfile({ nickname:"", firstName:"", lastName:"", city:"", avatarUrl:"", ...data.profile });
        } else {
          loadFromLS();
        }
      } catch {
        loadFromLS();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const o = search.get("open");
    if (o === "shipping" || o === "payment" || o === "sizing" || o === "profile") setOpen(o);
  }, [search]);

  const loadFromLS = () => {
    try {
      const s = localStorage.getItem(LS_KEYS.shipping); if (s) setShipping(JSON.parse(s));
      const p = localStorage.getItem(LS_KEYS.payment);  if (p) setPayment(JSON.parse(p));
      const z = localStorage.getItem(LS_KEYS.sizing);   if (z) setSizing(JSON.parse(z));
      const pr= localStorage.getItem(LS_KEYS.profile);  if (pr) setProfile(JSON.parse(pr));
    } catch {}
  };

  const persistServer = async (section: "shipping" | "payment" | "sizing" | "profile") => {
    setSaving(section);
    try {
      const body = JSON.stringify({ shipping, payment, sizing, profile });
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) throw new Error("save failed");
      mirrorLS();
      setOpen(null);
    } catch {
      mirrorLS(); // fallback в LS
      setOpen(null);
    } finally {
      setSaving(null);
    }
  };

  const mirrorLS = () => {
    localStorage.setItem(LS_KEYS.shipping, JSON.stringify(shipping));
    localStorage.setItem(LS_KEYS.payment,  JSON.stringify(payment));
    localStorage.setItem(LS_KEYS.sizing,   JSON.stringify(sizing));
    localStorage.setItem(LS_KEYS.profile,  JSON.stringify(profile));
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="px-5 py-4 border-b border-gray-200 sticky top-0 bg-white/70 backdrop-blur z-30">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Налаштування</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <SettingItem title="Профіль"
            subtitle={profile.nickname ? `@${profile.nickname}` : "Додайте базову інформацію"}
            onClick={() => setOpen("profile")} />
          <SettingItem title="Адреса доставки"
            subtitle={shipping.fullName ? `${shipping.fullName}, ${shipping.city || shipping.country}` : "Додайте адресу"}
            onClick={() => setOpen("shipping")} />
          <SettingItem title="Платіжна інформація"
            subtitle={payment.last4 ? `Карта •••• ${payment.last4}, ${payment.expMonth}/${payment.expYear}` : "Додайте платіжні дані"}
            onClick={() => setOpen("payment")} />
          <SettingItem title="Розмірна сітка"
            subtitle={sizing.height && sizing.weight ? `Зріст ${sizing.height} см, вага ${sizing.weight} кг` : "Додайте свої розміри"}
            onClick={() => setOpen("sizing")} />
        </div>

        {loading && <p className="text-sm text-gray-500 mt-3">Завантаження…</p>}
      </main>

      {/* PROFILE modal */}
      <Modal open={open === "profile"} title="Профіль" onClose={() => setOpen(null)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Text label="Нікнейм"    value={profile.nickname} onChange={(v) => setProfile({ ...profile, nickname: v.replace(/\s/g, "").slice(0,24) })} />
          <Text label="Місто"      value={profile.city}     onChange={(v) => setProfile({ ...profile, city: v })} />
          <Text label="Ім’я"       value={profile.firstName} onChange={(v) => setProfile({ ...profile, firstName: v })} />
          <Text label="Прізвище"   value={profile.lastName}  onChange={(v) => setProfile({ ...profile, lastName: v })} />
          <Text label="URL аватару (необов’язково)" value={profile.avatarUrl} onChange={(v) => setProfile({ ...profile, avatarUrl: v })} className="sm:col-span-2" />
        </div>
        <ModalActions onClose={() => setOpen(null)} onSave={() => persistServer("profile")} saving={saving === "profile"} />
      </Modal>

      {/* SHIPPING */}
      <Modal open={open === "shipping"} title="Адреса доставки" onClose={() => setOpen(null)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Text label="ПІБ" value={shipping.fullName} onChange={(v) => setShipping({ ...shipping, fullName: v })} />
          <Text label="Телефон" value={shipping.phone} onChange={(v) => setShipping({ ...shipping, phone: v })} />
          <Text label="Країна" value={shipping.country} onChange={(v) => setShipping({ ...shipping, country: v })} />
          <Text label="Місто" value={shipping.city} onChange={(v) => setShipping({ ...shipping, city: v })} />
          <Text label="Адреса (вул., буд., кв.)" value={shipping.address1} onChange={(v) => setShipping({ ...shipping, address1: v })} className="sm:col-span-2" />
          <Text label="Додаткова адреса (необов’язково)" value={shipping.address2 || ""} onChange={(v) => setShipping({ ...shipping, address2: v })} className="sm:col-span-2" />
          <Text label="Поштовий індекс" value={shipping.zip} onChange={(v) => setShipping({ ...shipping, zip: v })} />
        </div>
        <ModalActions onClose={() => setOpen(null)} onSave={() => persistServer("shipping")} saving={saving === "shipping"} />
      </Modal>

      {/* PAYMENT */}
      <Modal open={open === "payment"} title="Платіжна інформація" onClose={() => setOpen(null)}>
        <p className="text-xs text-gray-500 mb-3">З міркувань безпеки зберігаємо лише власника, останні 4 цифри та строк дії.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Text label="Власник карти" value={payment.holder} onChange={(v) => setPayment({ ...payment, holder: v })} className="sm:col-span-2" />
          <Text label="Останні 4 цифри" value={payment.last4} onChange={(v) => setPayment({ ...payment, last4: v.replace(/\D/g, "").slice(0, 4) })} />
          <Text label="Місяць (MM)" value={payment.expMonth} onChange={(v) => setPayment({ ...payment, expMonth: v.replace(/\D/g, "").slice(0, 2) })} />
          <Text label="Рік (YY)" value={payment.expYear} onChange={(v) => setPayment({ ...payment, expYear: v.replace(/\D/g, "").slice(0, 2) })} />
        </div>
        <ModalActions onClose={() => setOpen(null)} onSave={() => persistServer("payment")} saving={saving === "payment"} />
      </Modal>

      {/* SIZING */}
      <Modal open={open === "sizing"} title="Розмірна сітка" onClose={() => setOpen(null)}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Стать" value={sizing.gender}
                  onChange={(v) => setSizing({ ...sizing, gender: v as Sizing["gender"] })}
                  options={[{label:"Чоловіча",value:"male"},{label:"Жіноча",value:"female"},{label:"Інша",value:"other"}]} />
          <Text label="Зріст (см)" value={sizing.height} onChange={(v) => setSizing({ ...sizing, height: v.replace(/\D/g, "").slice(0, 3) })} />
          <Text label="Вага (кг)"  value={sizing.weight} onChange={(v) => setSizing({ ...sizing, weight: v.replace(/\D/g, "").slice(0, 3) })} />
          <Text label="Груди (см)" value={sizing.chest} onChange={(v) => setSizing({ ...sizing, chest: v.replace(/\D/g, "").slice(0, 3) })} />
          <Text label="Талія (см)" value={sizing.waist} onChange={(v) => setSizing({ ...sizing, waist: v.replace(/\D/g, "").slice(0, 3) })} />
          <Text label="Стегна (см)" value={sizing.hips} onChange={(v) => setSizing({ ...sizing, hips: v.replace(/\D/g, "").slice(0, 3) })} />
          <Text label="Взуття (EU)" value={sizing.shoes} onChange={(v) => setSizing({ ...sizing, shoes: v.replace(/\D/g, "").slice(0, 2) })} />
        </div>
        <ModalActions onClose={() => setOpen(null)} onSave={() => persistServer("sizing")} saving={saving === "sizing"} />
      </Modal>
    </div>
  );
}

/* ---------- UI helpers ---------- */
function SettingItem({ title, subtitle, onClick }: { title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50 border-b last:border-b-0">
      <div>
        <div className="font-medium">{title}</div>
        {subtitle && <div className="text-sm text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
      <span aria-hidden className="text-gray-400">›</span>
    </button>
  );
}

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3">
        <div className="w-full sm:max-w-2xl rounded-2xl bg-white shadow-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-gray-100" title="Закрити">✕</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalActions({ onClose, onSave, saving }: { onClose: () => void; onSave: () => void; saving?: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={onClose} className="h-10 px-4 rounded-lg border border-gray-300">Скасувати</button>
      <button onClick={onSave} disabled={saving} className="h-10 px-4 rounded-lg bg-gray-900 text-white disabled:opacity-50">
        {saving ? "Збереження…" : "Зберегти"}
      </button>
    </div>
  );
}

function Text({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string; }) {
  return (
    <label className={`block ${className || ""}`}>
      <span className="text-sm text-gray-700">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full h-10 rounded-lg border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-gray-200" />
    </label>
  );
}

function Select({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; className?: string; }) {
  return (
    <label className={`block ${className || ""}`}>
      <span className="text-sm text-gray-700">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full h-10 rounded-lg border border-gray-300 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200">
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}
