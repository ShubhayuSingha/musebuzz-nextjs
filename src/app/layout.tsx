// src/app/layout.tsx
'use client'; 

import { Figtree } from "next/font/google"; // 1. Changed to Figtree
import "./globals.css";
import 'rc-slider/assets/index.css';
import Sidebar from "@/components/Sidebar";
import Player from "@/components/Player";
import { useState, useEffect } from "react";
import ModalProvider from '@/providers/ModalProvider';
import Header from "@/components/Header";
import SupabaseProvider from "@/providers/SupabaseProvider";
import ToasterProvider from "@/providers/ToasterProvider";

// 2. Configure Figtree
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
        // 3. Apply font.className here
        className={`${font.className} antialiased bg-zinc-900 text-zinc-50 flex flex-col h-screen`}
        suppressHydrationWarning
      >
        <SupabaseProvider>
          <ToasterProvider />
          <ModalProvider />
          
          <div className="flex flex-1 overflow-hidden">
            <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
            
            <main className="flex-1 overflow-y-auto pb-20">
              {/* Note: We removed the duplicate Header from the Queue page, 
                  so this global one handles the layout. */}
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