"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import TABS, { TabItem } from "./TabBar";

export default function BottomBar() {
  const pathname = usePathname() || "/";

  const isActive = (tab: TabItem) =>
    pathname === tab.href ||
    pathname.startsWith(tab.href + "/") ||
    (tab.aliases?.some((a) => pathname === a || pathname.startsWith(a + "/")) ?? false);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-6xl grid grid-cols-5">
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex flex-col items-center justify-center py-2.5 text-xs ${
                active ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span
                className={`mb-1 grid h-6 w-6 place-items-center rounded-full ${
                  active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {/* если у тебя свои иконки — подставятся; иначе простой маркер */}
                {tab.icon ?? <span className="text-[10px]">●</span>}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
