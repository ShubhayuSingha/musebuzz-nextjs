// src/app/lyrics-master/components/RawPayloadModal.tsx

'use client';

import React, { useState } from 'react';
import { FaTimes, FaCopy, FaCheck } from 'react-icons/fa';

interface RawPayloadModalProps {
  isOpen: boolean;
  title: string;
  payload: string | null;
  format: 'xml' | 'json';
  onClose: () => void;
}

export const RawPayloadModal: React.FC<RawPayloadModalProps> = ({
  isOpen,
  title,
  payload,
  format,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !payload) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-base">{title}</h3>
            <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-neutral-800 text-purple-400 font-bold">
              {format}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <FaCheck className="text-emerald-400 text-xs" />
                  Copied
                </>
              ) : (
                <>
                  <FaCopy className="text-xs" />
                  Copy Payload
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-auto p-4 bg-black/90 font-mono text-xs text-neutral-300 leading-relaxed custom-scrollbar whitespace-pre">
          {payload}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-neutral-950 border-t border-neutral-800 flex justify-between items-center text-xs text-neutral-500">
          <span>Payload length: {payload.length.toLocaleString()} characters</span>
          <button
            onClick={onClose}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-4 py-1.5 rounded-lg font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
