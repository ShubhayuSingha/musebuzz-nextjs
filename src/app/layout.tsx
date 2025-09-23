// src/app/layout.tsx
'use client'; 

import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Player from "@/components/Player";
import { useState, useEffect } from "react";

const inter = Inter({ subsets: ["latin"] });

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
        className={`${inter.className} antialiased bg-zinc-900 text-zinc-50 flex flex-col h-screen`}
        suppressHydrationWarning
      >
        <div className="flex flex-1 overflow-hidden">
          <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
          {/* THIS IS THE CORRECTED LINE */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <Player />
      </body>
    </html>
  );
}