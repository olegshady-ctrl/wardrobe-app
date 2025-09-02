import React, { useRef, useState, useEffect } from "react";

// ────────────────────────────────────────────────────────────────────────────────
// Material 3 (Google‑style) MVP tokens — можно заменить позже на экспорт из Figma
// ────────────────────────────────────────────────────────────────────────────────
const tokens = {
  radius: 16,
  spacing: 12,
  color: {
    primary: "#6750A4",
    onPrimary: "#FFFFFF",
    surface: "#FFFBFE",
    surfaceVariant: "#F3EDF7",
    onSurface: "#1C1B1F",
    outline: "#79747E",
    secondary: "#625B71",
    onSecondary: "#FFFFFF",
    error: "#B3261E",
  },
  shadow: "0 6px 24px rgba(0,0,0,0.08)",
};

// ────────────────────────────────────────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
// ────────────────────────────────────────────────────────────────────────────────
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  // Простые emoji-иконки как плейсхолдеры M3 — заменим позже на Material Symbols
  const map: Record<string, string> = {
    save: "💾",
    camera: "📷",
    gallery: "🖼️",
    export: "📤",
    back: "←",
    more: "⋯",
    like: "❤",
    search: "🔍",
    reset: "⤾",
  };
  return (
    <span style={{ fontSize: size, lineHeight: 1 }}>{map[name] ?? "⬜"}</span>
  );
}

function Button({
  children,
  onClick,
  variant = "filled",
  full,
}: React.PropsWithChildren<{
  onClick?: () => void;
  variant?: "filled" | "tonal" | "outline";
  full?: boolean;
}>) {
  const base: React.CSSProperties = {
    padding: `${tokens.spacing}px ${tokens.spacing * 1.5}px`,
    borderRadius: tokens.radius,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    fontWeight: 600,
    border: "1px solid transparent",
    boxShadow: "none",
    cursor: "pointer",
    width: full ? "100%" : undefined,
  };
  const styles: Record<string, React.CSSProperties> = {
    filled: {
      background: tokens.color.primary,
      color: tokens.color.onPrimary,
    },
    tonal: {
      background: tokens.color.surfaceVariant,
      color: tokens.color.onSurface,
    },
    outline: {
      background: "transparent",
      color: tokens.color.onSurface,
      borderColor: tokens.color.outline,
    },
  };
  return (
    <button style={{ ...base, ...styles[variant] }} onClick={onClick}>
      {children}
    </button>
  );
}

function Chip({ active, label, onClick }: { active?: boolean; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? tokens.color.primary : tokens.color.outline}`,
        color: active ? tokens.color.primary : tokens.color.onSurface,
        background: active ? "rgba(103,80,164,0.10)" : "transparent",
      }}
    >
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ОСНОВНОЙ ЭКРАН: "ЗІБРАТИ ЛУК"
// Mobile‑first верстка + жесты свайпа между вкладками + болванка для камеры/галереи
// ────────────────────────────────────────────────────────────────────────────────
export default function ZibratyLukMVP() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<"photo" | "collage">("photo");
  const [caption, setCaption] = useState("");
  const [elements] = useState(
    () => Array.from({ length: 12 }).map((_, i) => ({ id: i + 1, name: `Елемент ${i + 1}` }))
  );

  // Фото пользователя (из камеры/галереи)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Примитивный свайп‑переключатель вкладок (без сторонних библиотек)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let isTouch = false;

    const onTouchStart = (e: TouchEvent) => {
      isTouch = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!isTouch) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;
      // Горизонтальный свайп сильнее вертикального
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0 && activeTab === "photo") setActiveTab("collage");
        if (dx > 0 && activeTab === "collage") setActiveTab("photo");
      }
      isTouch = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [activeTab]);

  // Загрузка фото из галереи (веб‑болванка). В нативе подключим @capacitor/camera
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onPickFromGallery = () => fileInputRef.current?.click();
  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  // Плейсхолдеры действий
  const onOpenCamera = () => {
    alert("Камера будет подключена через @capacitor/camera (Android/iOS)");
  };
  const onExportPNG = () => {
    alert("Экспорт PNG: соберём слой фото + коллаж на <canvas> и сохраним/поделимся через @capacitor/share");
  };
  const onSaveLook = () => {
    alert("Сохранено как черновик. В нативе — в Filesystem, затем синхронизация с бэком.");
  };

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        background: tokens.color.surface,
        color: tokens.color.onSurface,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      {/* AppBar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: tokens.color.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${tokens.spacing + 2}px ${tokens.spacing}px`,
          borderBottom: `1px solid ${tokens.color.outline}33`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="back" />
          <div style={{ fontWeight: 700 }}>Зібрати лук</div>
        </div>
        <button
          onClick={onSaveLook}
          style={{
            border: "none",
            background: "transparent",
            padding: 6,
            borderRadius: 10,
          }}
          aria-label="Зберегти"
        >
          <Icon name="save" />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, padding: `${tokens.spacing}px ${tokens.spacing}px 0` }}>
        <Chip label="Фото" active={activeTab === "photo"} onClick={() => setActiveTab("photo")} />
        <Chip label="Колаж" active={activeTab === "collage"} onClick={() => setActiveTab("collage")} />
      </div>

      {/* Canvas area */}
      <div
        style={{
          margin: tokens.spacing,
          borderRadius: tokens.radius,
          background: tokens.color.surfaceVariant,
          height: "56vh",
          overflow: "hidden",
          position: "relative",
          boxShadow: tokens.shadow,
        }}
      >
        {/* Вкладка Фото */}
        {activeTab === "photo" && (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Фото користувача"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div style={{ opacity: 0.7, textAlign: "center", padding: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Додайте фото</div>
                <div style={{ fontSize: 14 }}>Завантажте з камери або галереї. Свайп вліво — перейти до колажу.</div>
              </div>
            )}
          </div>
        )}

        {/* Вкладка Колаж (пока болванка) */}
        {activeTab === "collage" && (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <div style={{ textAlign: "center", opacity: 0.8 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Полотно колажу</div>
                <div style={{ fontSize: 14 }}>
                  Тут зʼявляться елементи одягу з можливістю перетягування, масштабу та повороту.
                </div>
              </div>
            </div>
            <div style={{ position: "absolute", right: 10, bottom: 10 }}>
              <Button variant="tonal" onClick={() => alert("Скидання трансформацій (TODO)")}> 
                <Icon name="reset" /> Скинути
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Caption / подпись как в Instagram */}
      <div style={{ padding: `${tokens.spacing}px ${tokens.spacing}px 0` }}>
        <label style={{ display: "block", fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Підпис до лука</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          placeholder="Щось про твій лук…"
          style={{
            width: "100%",
            borderRadius: tokens.radius,
            border: `1px solid ${tokens.color.outline}`,
            padding: 12,
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Кнопки действий */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: tokens.spacing,
          padding: tokens.spacing,
        }}
      >
        <Button full onClick={onOpenCamera}><Icon name="camera" /> З камери</Button>
        <Button full variant="tonal" onClick={onPickFromGallery}><Icon name="gallery" /> З галереї</Button>
        <Button full variant="outline" onClick={onExportPNG}><Icon name="export" /> Експорт PNG</Button>
        <Button full onClick={onSaveLook}><Icon name="save" /> Зберегти лук</Button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
      </div>

      {/* Bottom sheet: элементы одежды */}
      <div
        style={{
          borderTop: `1px solid ${tokens.color.outline}33`,
          padding: `${tokens.spacing}px ${tokens.spacing}px ${tokens.spacing + 2}px`,
          background: tokens.color.surface,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="search" />
          <input
            placeholder="Пошук елементів…"
            style={{
              flex: 1,
              border: `1px solid ${tokens.color.outline}`,
              borderRadius: 999,
              padding: "10px 14px",
              fontFamily: "inherit",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {elements.map((el) => (
            <div
              key={el.id}
              style={{
                flex: "0 0 auto",
                width: 84,
                height: 84,
                borderRadius: 14,
                border: `1px solid ${tokens.color.outline}`,
                background: tokens.color.surfaceVariant,
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                boxShadow: tokens.shadow,
              }}
              onClick={() => alert(`Додано до полотна: ${el.name} (TODO drag/resize/rotate)`) }
            >
              {el.name}
            </div>
          ))}
        </div>
      </div>

      {/* Низ страницы — отступ под жест навигации */}
      <div style={{ height: 12 }} />
    </div>
  );
}

/*
──────────────────────────────────────────────────────────────────────────────────
Шпаргалка по интеграции нативных возможностей через Capacitor (после сборки web):

1) npx cap init wardrobe-ai com.carmods.wardrobe
2) npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
3) npm i @capacitor/camera @capacitor/filesystem @capacitor/haptics @capacitor/share @capacitor/push-notifications @capacitor/app @capacitor/geolocation
4) npx cap add android && npx cap add ios
5) npx cap sync
6) AndroidManifest/Info.plist — разрешения (CAMERA, NOTIFICATIONS, LOCATION), причины использования
7) Подключение камеры:
   import { Camera, CameraResultType } from '@capacitor/camera'
   const img = await Camera.getPhoto({ quality: 0.8, resultType: CameraResultType.DataUrl })
8) Пуши: настроить FCM (Android) и APNs (iOS), обрабатывать deep links.
9) Экспорт PNG: собрать слои на <canvas>, затем @capacitor/share для шаринга в соцсети.
10) Производительность: lazy import'ы, кеш, скелетоны.

Позже заменим токены на экспорт из Figma (Material Theme Builder) — цвета, типографика, радиусы.
──────────────────────────────────────────────────────────────────────────────────
*/
