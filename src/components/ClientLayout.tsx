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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile sidebar overlay

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    // Save to cookie for server-side persistence
    document.cookie = `sidebar_collapsed=${newState}; path=/; max-age=${60 * 60 * 24 * 30}`;
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <>
        <ToasterProvider />
        <ModalProvider />
        
        <div className="flex flex-1 overflow-hidden h-full relative">
            
            {/* Mobile Backdrop Overlay */}
            {mobileMenuOpen && (
              <div 
                className="fixed inset-0 bg-black/50 z-[55] md:hidden"
                onClick={toggleMobileMenu}
              />
            )}

            {/* Combined Sidebar with Mobile Overlay behavior */}
            <div className={`
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
                md:translate-x-0 
                fixed md:static 
                inset-y-0 left-0 
                z-[60] md:z-auto 
                transition-transform duration-300 ease-in-out
                flex h-full
            `}>
               <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} isMobileOpen={mobileMenuOpen} closeMobile={toggleMobileMenu} />
            </div>
            
            {/* 🟢 THE FIX: A vertical column wrapper for the entire right side */}
            <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
                
                {/* 1. Header sits proudly at the top, immune to shrinking */}
                <Header onMenuClick={toggleMobileMenu} />
                
                {/* 2. Main content and Queue sit side-by-side UNDER the Header */}
                <div className="flex flex-1 overflow-hidden relative">
                    <main className="flex-1 overflow-y-auto pb-20 md:pb-0 min-w-0">
                        {children}
                    </main>
                    
                    {/* Desktop Queue - Hidden on mobile because it renders inside the expanded player */}
                    <div className="hidden md:flex relative h-full">
                        <Queue />
                    </div>
                </div>
                
            </div>
        </div>
        
        <Player />
    </>
  );
};

export default ClientLayout;