// src/app/lyrics-master/components/TtmlInspectionCard.tsx

'use client';

import React, { useState } from 'react';
import { UnifiedLyrics } from '../types/lyricsMaster.types';
import { 
  FaApple, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaCode, 
  FaCopy, 
  FaUserEdit 
} from 'react-icons/fa';

interface TtmlInspectionCardProps {
  ttmlLyrics: UnifiedLyrics | null;
  rawXml: string | null;
  errorMessage?: string | null;
  onViewRawXml: () => void;
}

export const TtmlInspectionCard: React.FC<TtmlInspectionCardProps> = ({
  ttmlLyrics,
  rawXml,
  errorMessage,
  onViewRawXml,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    if (rawXml) {
      navigator.clipboard.writeText(rawXml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getGranularityBadge = (granularity: string, isGenuineSyllable: boolean) => {
    if (isGenuineSyllable) {
      return (
        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
          <FaCheckCircle className="text-[10px]" /> Syllable-Level Verified
        </span>
      );
    }
    if (granularity === 'word') {
      return (
        <span className="bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
          <FaCheckCircle className="text-[10px]" /> Word-Level Timing
        </span>
      );
    }
    if (granularity === 'line') {
      return (
        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
          <FaExclamationTriangle className="text-[10px]" /> Line-Level Only
        </span>
      );
    }
    return (
      <span className="bg-neutral-800 text-neutral-400 text-xs px-2.5 py-0.5 rounded-full font-semibold">
        Untimed / Plain
      </span>
    );
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaApple className="text-neutral-100 text-xl" />
            TTML / XML Parser Inspection
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Apple Music raw TTML inspection & timing structure analysis
          </p>
        </div>

        {rawXml && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5"
            >
              <FaCopy className="text-xs" />
              {copied ? 'Copied' : 'Copy XML'}
            </button>
            <button
              onClick={onViewRawXml}
              className="bg-purple-950/50 hover:bg-purple-900/50 text-purple-300 border border-purple-800/60 text-xs px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5"
            >
              <FaCode className="text-xs" />
              View Raw XML
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-amber-300 text-xs mb-3 flex items-start gap-2">
          <FaExclamationTriangle className="shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      {ttmlLyrics ? (
        <div className="space-y-4">
          {/* Top badges bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 font-semibold">Granularity:</span>
              {getGranularityBadge(ttmlLyrics.actualGranularity, ttmlLyrics.isGenuineSyllableSync)}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-400">Declared itunes:timing:</span>
              <span className="font-mono text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/50 font-bold">
                &quot;{ttmlLyrics.declaredSyncLevel}&quot;
              </span>
            </div>
          </div>

          {/* Granularity Evaluation Rationale */}
          <div className="p-3 bg-black/40 border border-neutral-800 rounded-xl text-xs">
            <span className="font-bold text-neutral-300">Auditor Finding: </span>
            <span className="text-neutral-400">{ttmlLyrics.granularityReason}</span>
          </div>

          {/* Key Metric Numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-neutral-950/50 border border-neutral-800 p-2.5 rounded-xl">
              <div className="text-xs text-neutral-500 font-semibold uppercase">Total Lines</div>
              <div className="text-lg font-bold text-white font-mono mt-0.5">{ttmlLyrics.lines.length}</div>
            </div>

            <div className="bg-neutral-950/50 border border-neutral-800 p-2.5 rounded-xl">
              <div className="text-xs text-neutral-500 font-semibold uppercase">Timed Sub-spans</div>
              <div className="text-lg font-bold text-purple-400 font-mono mt-0.5">
                {ttmlLyrics.diagnostics.totalSegments}
              </div>
            </div>

            <div className="bg-neutral-950/50 border border-neutral-800 p-2.5 rounded-xl">
              <div className="text-xs text-neutral-500 font-semibold uppercase">Leading Silence</div>
              <div className="text-lg font-bold text-neutral-300 font-mono mt-0.5">
                {ttmlLyrics.leadingSilenceSec !== undefined ? `${ttmlLyrics.leadingSilenceSec.toFixed(3)}s` : 'N/A'}
              </div>
            </div>

            <div className="bg-neutral-950/50 border border-neutral-800 p-2.5 rounded-xl">
              <div className="text-xs text-neutral-500 font-semibold uppercase">Language</div>
              <div className="text-lg font-bold text-neutral-300 font-mono mt-0.5">
                {ttmlLyrics.language || 'Unspecified'}
              </div>
            </div>
          </div>

          {/* Songwriter & Metadata info */}
          {ttmlLyrics.songwriters && ttmlLyrics.songwriters.length > 0 && (
            <div className="p-3 bg-neutral-950/50 border border-neutral-800 rounded-xl text-xs flex items-center gap-2">
              <FaUserEdit className="text-purple-400 shrink-0" />
              <span className="text-neutral-400 font-semibold">Songwriters:</span>
              <span className="text-neutral-200">{ttmlLyrics.songwriters.join(', ')}</span>
            </div>
          )}

          {/* Parsing warnings */}
          {ttmlLyrics.diagnostics.warnings.length > 0 && (
            <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                <FaExclamationTriangle className="text-xs" />
                Timing Warnings:
              </div>
              {ttmlLyrics.diagnostics.warnings.map((w, idx) => (
                <div key={idx} className="text-amber-300/90 pl-4 list-disc">
                  &bull; {w}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-xs">
          No TTML document loaded. Click <span className="text-purple-400 font-semibold">&quot;1. Fetch TTML&quot;</span> to request the XML track.
        </div>
      )}
    </div>
  );
};
