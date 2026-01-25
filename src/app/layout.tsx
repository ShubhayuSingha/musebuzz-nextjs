// src/app/layout.tsx

import { Figtree } from "next/font/google"; 
import "./globals.css";
import 'rc-slider/assets/index.css';

import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import SupabaseProvider from "@/providers/SupabaseProvider";
// 🟢 Update Import
import ClientLayout from "@/components/ClientLayout"; 

const font = Figtree({ 
  subsets: ["latin"] 
});

export const metadata = {
  title: 'MuseBuzz',
  description: 'Listen to music!',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  
  const supabase = createServerComponentClient({ cookies: () => cookieStore as any });
  const {
      data: { session },
  } = await supabase.auth.getSession();

  const collapsedCookie = cookieStore.get('sidebar_collapsed');
  const defaultCollapsed = collapsedCookie?.value === 'true';

  return (
    <html lang="en">
      <body className={`${font.className} antialiased bg-zinc-900 text-zinc-50 flex flex-col h-screen`}>
        <SupabaseProvider session={session}>
           
           {/* 🟢 Update Component Usage */}
           <ClientLayout defaultCollapsed={defaultCollapsed}>
              {children}
           </ClientLayout>

        </SupabaseProvider>
      </body>
    </html>
  );
}