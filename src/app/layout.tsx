// src/app/layout.tsx
'use client'; 

import { Figtree } from "next/font/google"; 
import "./globals.css";
import 'rc-slider/assets/index.css';
import { useState, useEffect } from "react";

// Components
import Sidebar from "@/components/Sidebar";
import Player from "@/components/Player";
import Header from "@/components/Header";
import Queue from "@/components/Queue"; 

// Providers
import ModalProvider from '@/providers/ModalProvider';
import SupabaseProvider from "@/providers/SupabaseProvider";
import ToasterProvider from "@/providers/ToasterProvider";

const font = Figtree({ 
  subsets: ["latin"] 
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
    <html lang="en">
      <body
        className={`${font.className} antialiased bg-zinc-900 text-zinc-50 flex flex-col h-screen`}
        suppressHydrationWarning
      >
        <SupabaseProvider>
          <ToasterProvider />
          <ModalProvider />
          
          {/* MAIN FLEX CONTAINER */}
          <div className="flex flex-1 overflow-hidden">
            <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
            
            {/* 👇 FIXED: Added 'min-w-0' 
                This forces the main content to shrink when Queue opens, 
                even if the Home page grid wants to stay wide. */}
            <main className="flex-1 overflow-y-auto pb-20 min-w-0">
              <Header />
              {children}
            </main>
            
            <Queue />

          </div>
          
          <Player />
        </SupabaseProvider>
      </body>
    </html>
  );
}