// app/components/TabBar.ts
import React from "react";

export type TabItem = {
  key: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  aliases?: string[];
};

const TABS: TabItem[] = [
  { key: "wardrobe", label: "Гардероб", href: "/wardrobe" },
  { key: "looks",    label: "Луки", href: "/outfits" },
  { key: "compose",  label: "Зібрати лук", href: "/compose" },
  { key: "feed",     label: "Стрічка", href: "/feed" },
  // Профіль убран из таббара
];

export default TABS;
