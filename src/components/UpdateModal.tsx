// src/components/UpdateModal.tsx
'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import updates from '@/lib/updates.json';

// Grabs the unique Git ID provided by Vercel automatically
const APP_VERSION = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development';

const UpdateModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Grabs the latest update record from the top of the JSON array
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

  const cleanTitle = latestUpdate.title ? latestUpdate.title.replace(/⚡/g, '').trim() : 'Release Updates';

  return (
    <Modal
      isOpen={isOpen}
      onChange={onClose}
      hideCloseButton={true}
      className="max-w-[490px] max-h-[85vh] p-5 sm:p-6"
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Header with Release Badge */}
        <div className="flex-shrink-0 text-center mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-2 shadow-[0_0_12px_rgba(168,85,247,0.15)]">
            <span className="text-purple-400">⚡</span>
            <span>{latestUpdate.versionName || 'Release Update'}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {cleanTitle}
          </h2>
          {latestUpdate.description && (
            <p className="mt-1 text-xs text-neutral-400 leading-relaxed max-w-sm mx-auto">
              {latestUpdate.description}
            </p>
          )}
        </div>

        {/* Scrollable Content: What's New & Deployment Metadata */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 custom-scrollbar flex flex-col gap-4 py-1">
          {/* Dynamic Change Log from JSON with hanging indent bullets */}
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
              What's New:
            </p>
            <ul className="flex flex-col gap-2">
              {latestUpdate.changes.map((change, index) => (
                <li key={index} className="flex items-start gap-2.5 text-xs text-neutral-300 leading-relaxed group">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0 shadow-[0_0_6px_rgba(168,85,247,0.7)] group-hover:scale-125 transition-transform" />
                  <span className="flex-1">{change}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Deployment Metadata Box */}
          <div className="bg-zinc-950/70 p-3.5 rounded-xl border border-zinc-800/80">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-neutral-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                Deployment Info
              </p>
              <p className="text-purple-400 text-[10px] font-mono font-medium">
                {latestUpdate.date} @ {latestUpdate.time}
              </p>
            </div>
            <div className="flex flex-col gap-y-1 mt-2 border-t border-zinc-800/80 pt-2">
              <p className="text-neutral-500 text-[9px] uppercase tracking-wider font-semibold">Build SHA</p>
              <code className="text-neutral-300 text-[10px] block truncate font-mono bg-zinc-900/90 px-2 py-1 rounded border border-zinc-800">
                {APP_VERSION}
              </code>
            </div>
          </div>
        </div>

        {/* Pinned Bottom Action: Guaranteed reachable on all devices */}
        <div className="pt-3.5 mt-2 border-t border-zinc-800/80 flex-shrink-0">
          <button 
            onClick={onClose} 
            className="
              w-full 
              py-2.5 
              px-6 
              rounded-full 
              bg-gradient-to-r 
              from-purple-600 
              to-indigo-600 
              hover:from-purple-500 
              hover:to-indigo-500 
              text-white 
              font-semibold 
              text-sm
              shadow-[0_0_15px_rgba(168,85,247,0.35)] 
              hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] 
              active:scale-[0.98] 
              transition-all
            "
          >
            Got it!
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UpdateModal;
