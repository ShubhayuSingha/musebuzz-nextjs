'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';

/** * 📝 EDIT THESE THREE CONSTANTS FOR EVERY UPDATE 📝
 */
const UPDATE_TITLE = "Fresh Update Pushed! ⚡";
const UPDATE_DESCRIPTION = "We've added popups for new updates so you can stay in the loop.";
const CHANGES = [
  "Added automatic update notification system",
  "Improved UI with heavy Framer Motion animations",
  "Fixed seeking jitter with tabular-nums",
  "Security patch for Next.js 15"
];

// Grabs the unique Git ID provided by Vercel
const APP_VERSION = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development';

const UpdateModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('musebuzz-seen-version');
    if (APP_VERSION !== 'development' && lastSeenVersion !== APP_VERSION) {
      setIsOpen(true);
    }
  }, []);

  const onClose = () => {
    localStorage.setItem('musebuzz-seen-version', APP_VERSION);
    setIsOpen(false);
  };

  return (
    <Modal
      title={UPDATE_TITLE}
      description={UPDATE_DESCRIPTION}
      isOpen={isOpen}
      onChange={onClose}
    >
      <div className="flex flex-col gap-y-4">
        {/* Change Log Section */}
        <div className="flex flex-col gap-y-2">
           <p className="text-white text-sm font-semibold">What's New:</p>
           <ul className="text-neutral-400 text-xs list-disc list-inside flex flex-col gap-y-1">
             {CHANGES.map((change, index) => (
               <li key={index}>{change}</li>
             ))}
           </ul>
        </div>

        {/* Version Hash Box */}
        <div className="bg-neutral-900/50 p-4 rounded-md border border-neutral-800">
          <p className="text-neutral-300 text-[10px] uppercase tracking-widest font-bold">
            Build Version
          </p>
          <code className="text-purple-400 text-xs mt-1 block truncate font-mono">
            {APP_VERSION}
          </code>
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