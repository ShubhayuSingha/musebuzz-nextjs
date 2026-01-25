// src/components/ClientLayout.tsx

'use client'; 

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Queue from "@/components/Queue"; 
import Player from "@/components/Player";
import ModalProvider from '@/providers/ModalProvider';
import ToasterProvider from "@/providers/ToasterProvider";

interface ClientLayoutProps {
  children: React.ReactNode;
  defaultCollapsed: boolean; 
}

// 🟢 Renamed Component
const ClientLayout: React.FC<ClientLayoutProps> = ({ 
    children, 
    defaultCollapsed 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    // Save to cookie for server-side persistence
    document.cookie = `sidebar_collapsed=${newState}; path=/; max-age=${60 * 60 * 24 * 30}`;
  };

  return (
    <>
        <ToasterProvider />
        <ModalProvider />
        
        <div className="flex flex-1 overflow-hidden h-full">
            <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
            
            <main className="flex-1 overflow-y-auto pb-20 min-w-0">
                <Header />
                {children}
            </main>
            
            <Queue />
        </div>
        
        <Player />
    </>
  );
};

export default ClientLayout;