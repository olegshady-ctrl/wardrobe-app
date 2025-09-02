import type { Metadata } from 'next';
import './globals.css';
import BottomNav from './components/BottomNav';

export const metadata: Metadata = { title: 'Wardrobe', description: 'Wardrobe AI' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-screen bg-white text-zinc-900">
        <div className="pb-16">{children}</div> {/* место под нижний бар */}
        <BottomNav />
      </body>
    </html>
  );
}
