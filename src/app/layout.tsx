// src/app/layout.tsx

import { Figtree } from "next/font/google"; 
import "./globals.css";
import 'rc-slider/assets/index.css';

import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import SupabaseProvider from "@/providers/SupabaseProvider";
// 🟢 Update Import
import ClientLayout from "@/components/ClientLayout"; 
import PwaRegister from "@/components/PwaRegister";

const font = Figtree({ 
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap"
});

export const metadata = {
  title: 'MuseBuzz',
  description: 'Listen to music!',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icons/icon-192.png',
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MuseBuzz',
  },
};

export const viewport = {
  themeColor: '#18181b',
};

import { withTimeout } from "@/lib/helpers";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  
  const supabase = createServerComponentClient({ cookies: () => cookieStore as any });
  (supabase.auth as any).suppressGetSessionWarning = true;
  let session = null;
  try {
    // Read session directly from cookies (100% offline safe, zero network requests, instant auth)
    const sessionRes = await supabase.auth.getSession();
    session = sessionRes?.data?.session || null;
  } catch {
    session = null;
  }

  const collapsedCookie = cookieStore.get('sidebar_collapsed');
  const defaultCollapsed = collapsedCookie?.value === 'true';

  return (
    <html lang="en">
      <body className={`${font.className} ${font.variable} antialiased bg-zinc-900 text-zinc-50 flex flex-col h-screen h-[100dvh] overflow-x-hidden font-sans`}>
        <SupabaseProvider session={session}>
           
           {/* 🟢 Update Component Usage */}
           <ClientLayout defaultCollapsed={defaultCollapsed}>
              {children}
           </ClientLayout>
           <PwaRegister />

        </SupabaseProvider>
      </body>
    </html>
  );
}
