'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shirt, Sparkles, SquarePlus, Newspaper } from 'lucide-react';

type Tab = { href: string; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> };

const TABS: Tab[] = [
  { href: '/wardrobe', label: 'Гардероб',  Icon: Shirt },
  { href: '/looks',    label: 'Луки',      Icon: Sparkles },
  { href: '/compose',  label: 'Зібрати лук', Icon: SquarePlus },
  { href: '/feed',     label: 'Стрічка',   Icon: Newspaper },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto max-w-xl grid grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <li key={href} className="relative">
              <Link
                href={href}
                className="flex flex-col items-center justify-center gap-1 py-2"
              >
                <Icon size={22} className={active ? 'text-zinc-900' : 'text-zinc-500'} />
                <span className={`text-[11px] ${active ? 'text-zinc-900 font-medium' : 'text-zinc-500'}`}>
                  {label}
                </span>
              </Link>
              {/* нижний индикатор активного таба */}
              <span className={`pointer-events-none absolute left-6 right-6 -bottom-px h-0.5 ${active ? 'bg-zinc-900' : 'bg-transparent'}`} />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
