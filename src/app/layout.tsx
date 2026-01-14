// src/app/layout.tsx
'use client'; 

import { Inter } from "next/font/google";
import "./globals.css";
import 'rc-slider/assets/index.css';
import Sidebar from "@/components/Sidebar";
import Player from "@/components/Player";
import { useState, useEffect } from "react";
import ModalProvider from '@/providers/ModalProvider';
import Header from "@/components/Header";
import SupabaseProvider from "@/providers/SupabaseProvider";

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`antialiased bg-zinc-900 text-zinc-50 flex flex-col h-screen`}
        suppressHydrationWarning
      >
        <SupabaseProvider>
          <ModalProvider />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
            
            {/* --- FIX IS HERE --- */}
            {/* Added 'pb-20' to create space for the player at the bottom */}
            <main className="flex-1 overflow-y-auto pb-20">
              <Header />
              {children}
            </main>
            {/* ------------------- */}

          </div>
          <Player />
        </SupabaseProvider>
      </body>
    </html>
  );
}