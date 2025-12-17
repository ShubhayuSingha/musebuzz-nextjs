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

// 1. Define the font as a CSS variable
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
    // 2. Add the variable to the <html> tag
    <html lang="en" className={inter.variable}>
      <body
        className={`antialiased bg-zinc-900 text-zinc-50 flex flex-col h-screen`}
        suppressHydrationWarning
      >
        <SupabaseProvider>
          <ModalProvider />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
            <main className="flex-1 overflow-y-auto">
              <Header />
              {children}
            </main>
          </div>
          <Player />
        </SupabaseProvider>
      </body>
    </html>
  );
}