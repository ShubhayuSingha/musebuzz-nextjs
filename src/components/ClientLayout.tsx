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
            
            {/* 🟢 THE FIX: A vertical column wrapper for the entire right side */}
            <div className="flex flex-col flex-1 min-w-0">
                
                {/* 1. Header sits proudly at the top, immune to shrinking */}
                <Header />
                
                {/* 2. Main content and Queue sit side-by-side UNDER the Header */}
                <div className="flex flex-1 overflow-hidden">
                    <main className="flex-1 overflow-y-auto pb-20 min-w-0">
                        {children}
                    </main>
                    
                    <Queue />
                </div>
                
            </div>
        </div>
        
        <Player />
    </>
  );
};

export default ClientLayout;