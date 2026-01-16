// src/components/UpdateModal.tsx
'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import updates from '@/lib/updates.json'; // 1. Import your history file

// Grabs the unique Git ID provided by Vercel automatically
const APP_VERSION = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development';

const UpdateModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  // 2. Grabs the latest update record from the top of your JSON array
  const latestUpdate = updates[0];

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('musebuzz-seen-version');
    
    // Only show if the Git SHA has changed and we aren't in local dev mode
    if (APP_VERSION !== 'development' && lastSeenVersion !== APP_VERSION) {
      setIsOpen(true);
    }
  }, []);

  const onClose = () => {
    // Save the current Git SHA so the user doesn't see this specific update again
    localStorage.setItem('musebuzz-seen-version', APP_VERSION);
    setIsOpen(false);
  };

  return (
    <Modal
      title={latestUpdate.title}
      description={latestUpdate.description}
      isOpen={isOpen}
      onChange={onClose}
    >
      <div className="flex flex-col gap-y-4">
        {/* Dynamic Change Log from JSON */}
        <div className="flex flex-col gap-y-2">
           <p className="text-white text-sm font-semibold">What's New:</p>
           <ul className="text-neutral-400 text-xs list-disc list-inside flex flex-col gap-y-1">
             {latestUpdate.changes.map((change, index) => (
               <li key={index}>{change}</li>
             ))}
           </ul>
        </div>

        {/* Deployment Metadata Box */}
        <div className="bg-neutral-900/50 p-4 rounded-md border border-neutral-800">
          <div className="flex justify-between items-center mb-1">
             <p className="text-neutral-300 text-[10px] uppercase tracking-widest font-bold">
               Deployment Info
             </p>
             <p className="text-purple-400 text-[10px] font-mono">
               {latestUpdate.date} @ {latestUpdate.time}
             </p>
          </div>
          <div className="flex flex-col gap-y-1 mt-2 border-t border-neutral-800 pt-2">
            <p className="text-neutral-500 text-[9px] uppercase tracking-tighter">Build SHA</p>
            <code className="text-neutral-400 text-[10px] block truncate font-mono">
              {APP_VERSION}
            </code>
          </div>
        </div>

        <Button 
          onClick={onClose} 
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold transition w-full mt-2"
        >
          Got it!
        </Button>
      </div>
    </Modal>
  );
};

export default UpdateModal;