// src/app/lyrics-master/components/RetrievalPipelineControls.tsx

'use client';

import React from 'react';
import { 
  FaApple, 
  FaLayerGroup, 
  FaPlay, 
  FaTrashAlt, 
  FaCheckCircle, 
  FaInfoCircle, 
  FaExclamationTriangle 
} from 'react-icons/fa';

interface RetrievalPipelineControlsProps {
  hasSelectedSong: boolean;
  hasVideoId: boolean;
  isFetchingTtml: boolean;
  isFetchingJson: boolean;
  activeSource: 'ttml' | 'json' | null;
  pipelineStatus: {
    type: 'idle' | 'loading' | 'success' | 'warning' | 'error' | 'info';
    message: string;
  };
  onFetchTtml: () => void;
  onFetchJson: () => void;
  onRunAutoPipeline: () => void;
  onReset: () => void;
}

export const RetrievalPipelineControls: React.FC<RetrievalPipelineControlsProps> = ({
  hasSelectedSong,
  hasVideoId,
  isFetchingTtml,
  isFetchingJson,
  activeSource,
  pipelineStatus,
  onFetchTtml,
  onFetchJson,
  onRunAutoPipeline,
  onReset,
}) => {
  const isBusy = isFetchingTtml || isFetchingJson;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaLayerGroup className="text-purple-400 text-lg" />
            Lyrics Retrieval Pipeline
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Execute TTML-first retrieval with multi-provider fallback and diagnostics
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto Pipeline */}
          <button
            onClick={onRunAutoPipeline}
            disabled={!hasVideoId || isBusy}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            title="Attempts TTML first, audits granularity, and falls back to JSON if needed"
          >
            {isBusy ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FaPlay className="text-[10px]" />
            )}
            Run Auto Pipeline
          </button>

          {/* Fetch TTML button */}
          <button
            onClick={onFetchTtml}
            disabled={!hasVideoId || isBusy}
            className={`text-xs font-bold px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 border ${
              activeSource === 'ttml'
                ? 'bg-purple-950/60 border-purple-500 text-purple-300'
                : 'bg-black/60 border-neutral-700 hover:border-neutral-500 text-neutral-200'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <FaApple className="text-sm" />
            1. Fetch TTML
          </button>

          {/* Fetch JSON button */}
          <button
            onClick={onFetchJson}
            disabled={!hasVideoId || isBusy}
            className={`text-xs font-bold px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 border ${
              activeSource === 'json'
                ? 'bg-purple-950/60 border-purple-500 text-purple-300'
                : 'bg-black/60 border-neutral-700 hover:border-neutral-500 text-neutral-200'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <FaLayerGroup className="text-xs" />
            2. Fetch JSON
          </button>

          {/* Reset button */}
          <button
            onClick={onReset}
            disabled={isBusy}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold px-3 py-2.5 rounded-xl transition flex items-center gap-1.5"
            title="Reset in-memory retrieval results"
          >
            <FaTrashAlt className="text-xs" />
            Reset
          </button>
        </div>
      </div>

      {/* Step pipeline indicator */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
          hasSelectedSong ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400' : 'bg-black/30 border-neutral-800 text-neutral-500'
        }`}>
          <FaCheckCircle className="text-xs shrink-0" />
          <span className="truncate">1. Song Selected</span>
        </div>

        <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
          hasVideoId ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-400' : 'bg-black/30 border-neutral-800 text-neutral-500'
        }`}>
          <FaCheckCircle className="text-xs shrink-0" />
          <span className="truncate">2. Video ID Ready</span>
        </div>

        <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
          activeSource === 'ttml' ? 'bg-purple-950/30 border-purple-600/50 text-purple-300' : 'bg-black/30 border-neutral-800 text-neutral-500'
        }`}>
          <FaApple className="text-xs shrink-0" />
          <span className="truncate">3. TTML Candidate</span>
        </div>

        <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
          activeSource === 'json' ? 'bg-purple-950/30 border-purple-600/50 text-purple-300' : 'bg-black/30 border-neutral-800 text-neutral-500'
        }`}>
          <FaLayerGroup className="text-xs shrink-0" />
          <span className="truncate">4. JSON Fallback</span>
        </div>
      </div>

      {/* Status Banner */}
      {pipelineStatus.message && (
        <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
          pipelineStatus.type === 'loading'
            ? 'bg-blue-950/30 border-blue-800/50 text-blue-300'
            : pipelineStatus.type === 'success'
            ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
            : pipelineStatus.type === 'warning'
            ? 'bg-amber-950/30 border-amber-800/50 text-amber-300'
            : pipelineStatus.type === 'error'
            ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
            : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-300'
        }`}>
          {pipelineStatus.type === 'loading' && (
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
          )}
          {pipelineStatus.type === 'success' && <FaCheckCircle className="shrink-0 mt-0.5" />}
          {pipelineStatus.type === 'warning' && <FaExclamationTriangle className="shrink-0 mt-0.5" />}
          {pipelineStatus.type === 'error' && <FaExclamationTriangle className="shrink-0 mt-0.5" />}
          {pipelineStatus.type === 'idle' && <FaInfoCircle className="shrink-0 mt-0.5" />}
          <div className="flex-1 leading-relaxed">{pipelineStatus.message}</div>
        </div>
      )}
    </div>
  );
};
