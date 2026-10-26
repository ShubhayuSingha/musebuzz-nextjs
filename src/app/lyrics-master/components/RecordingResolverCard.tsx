// src/app/lyrics-master/components/RecordingResolverCard.tsx

'use client';

import React, { useState } from 'react';
import { DatabaseSong, ResolvedRecording, RecordingMatchAssessment } from '../types/lyricsMaster.types';
import { 
  FaYoutube, 
  FaCopy, 
  FaExternalLinkAlt, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaSearch, 
  FaSlidersH 
} from 'react-icons/fa';

interface RecordingResolverCardProps {
  selectedSong: DatabaseSong;
  resolvedRecording: ResolvedRecording | null;
  matchAssessment: RecordingMatchAssessment | null;
  isResolving: boolean;
  onResolve: () => void;
  onVideoIdChange: (newVideoId: string) => void;
}

export const RecordingResolverCard: React.FC<RecordingResolverCardProps> = ({
  selectedSong,
  resolvedRecording,
  matchAssessment,
  isResolving,
  onResolve,
  onVideoIdChange,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [customVideoIdInput, setCustomVideoIdInput] = useState<string>(resolvedRecording?.videoId || '');

  const videoId = resolvedRecording?.videoId || customVideoIdInput;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyCustomId = () => {
    if (customVideoIdInput.trim()) {
      onVideoIdChange(customVideoIdInput.trim());
    }
  };

  const getConfidenceBadge = (confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'WARNING') => {
    switch (confidence) {
      case 'HIGH':
        return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><FaCheckCircle className="text-[10px]" /> High Confidence Match</span>;
      case 'MEDIUM':
        return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><FaCheckCircle className="text-[10px]" /> Moderate Match</span>;
      case 'LOW':
        return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><FaExclamationTriangle className="text-[10px]" /> Low Confidence</span>;
      case 'WARNING':
        return <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1"><FaExclamationTriangle className="text-[10px]" /> Version Mismatch Warning</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaYoutube className="text-red-500 text-xl" />
            Recording Resolution & Video ID
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Matching &quot;{selectedSong.title}&quot; to YouTube recordings for LiriQo retrieval
          </p>
        </div>

        <button
          onClick={onResolve}
          disabled={isResolving}
          className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-md active:scale-95"
        >
          {isResolving ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Resolving Recording...
            </>
          ) : (
            <>
              <FaSearch className="text-xs" />
              {resolvedRecording ? 'Re-resolve Song' : 'Resolve with LiriQo'}
            </>
          )}
        </button>
      </div>

      {/* Video ID Controller */}
      <div className="bg-black/50 border border-neutral-800 rounded-xl p-4 mb-4">
        <label className="block text-xs font-semibold text-neutral-400 mb-1.5 flex items-center justify-between">
          <span>Active YouTube Video ID for API requests</span>
          <span className="text-[11px] text-neutral-500">You can also manually edit or paste a YouTube ID</span>
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customVideoIdInput}
            onChange={(e) => setCustomVideoIdInput(e.target.value)}
            placeholder="e.g. HaEYUJ2aRHs or a3FVEgsi5ag"
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-purple-500"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyCustomId}
              disabled={!customVideoIdInput.trim() || customVideoIdInput === resolvedRecording?.videoId}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs px-3 py-2 rounded-lg font-semibold transition disabled:opacity-40"
            >
              Apply ID
            </button>

            {videoId && (
              <>
                <button
                  onClick={() => handleCopy(videoId)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5"
                >
                  <FaCopy className="text-xs" />
                  {copied ? 'Copied' : 'Copy'}
                </button>

                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-800/60 text-xs px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5"
                >
                  <FaExternalLinkAlt className="text-[10px]" />
                  Watch
                </a>
              </>
            )}
          </div>
        </div>

        {/* Quick link inspector */}
        {videoId && (
          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400">
            <span className="text-neutral-500">Direct endpoints:</span>
            <a
              href={`https://api.liriqo-alfarrizi.my.id/v1/ttml?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline flex items-center gap-1"
            >
              /ttml?v={videoId} <FaExternalLinkAlt className="text-[8px]" />
            </a>
            <span>&bull;</span>
            <a
              href={`https://api.liriqo-alfarrizi.my.id/v1/lyrics?v=${videoId}&debug=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline flex items-center gap-1"
            >
              /lyrics?v={videoId} <FaExternalLinkAlt className="text-[8px]" />
            </a>
          </div>
        )}
      </div>

      {/* Resolved Metadata & Comparison Assessment */}
      {resolvedRecording ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Resolved Recording Metadata</p>
              <h3 className="font-bold text-white text-base mt-0.5">{resolvedRecording.title}</h3>
              <p className="text-xs text-neutral-300">
                by <span className="font-semibold text-purple-400">{resolvedRecording.artist}</span>
                {resolvedRecording.album ? ` &bull; Album: ${resolvedRecording.album}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              {matchAssessment && getConfidenceBadge(matchAssessment.confidence)}
              {resolvedRecording.rawMatchScore !== undefined && (
                <p className="text-[11px] text-neutral-500 mt-1 font-mono">
                  Resolver Match Score: {resolvedRecording.rawMatchScore}
                </p>
              )}
            </div>
          </div>

          {/* Warnings & Diagnostics from Match Assessment */}
          {matchAssessment && (
            <div className="bg-black/40 border border-neutral-800 rounded-xl p-3 text-xs space-y-2">
              <div className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <FaSlidersH className="text-purple-400" />
                Catalog vs External Audio Match Analysis:
              </div>

              {matchAssessment.details.map((detail, i) => (
                <div key={i} className="text-neutral-400 flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold shrink-0">&check;</span>
                  <span>{detail}</span>
                </div>
              ))}

              {matchAssessment.warnings.map((warn, i) => (
                <div key={i} className="text-amber-400 flex items-start gap-1.5 bg-amber-950/20 p-2 rounded border border-amber-800/40">
                  <FaExclamationTriangle className="text-amber-400 shrink-0 mt-0.5" />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-xs">
          Click <span className="text-purple-400 font-semibold">&quot;Resolve with LiriQo&quot;</span> or paste a video ID above to start retrieving lyrics.
        </div>
      )}
    </div>
  );
};
