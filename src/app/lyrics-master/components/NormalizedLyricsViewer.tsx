// src/app/lyrics-master/components/NormalizedLyricsViewer.tsx

'use client';

import React, { useState } from 'react';
import { UnifiedLyrics } from '../types/lyricsMaster.types';
import { formatMsToClock } from '../utils/timestampParser';
import { 
  FaChevronDown, 
  FaChevronRight, 
  FaPlay, 
  FaClock 
} from 'react-icons/fa';

interface NormalizedLyricsViewerProps {
  lyrics: UnifiedLyrics | null;
  currentTimeMs: number;
  activeLineIndex: number;
  onSeek: (ms: number) => void;
}

export const NormalizedLyricsViewer: React.FC<NormalizedLyricsViewerProps> = ({
  lyrics,
  currentTimeMs,
  activeLineIndex,
  onSeek,
}) => {
  const [expandedLines, setExpandedLines] = useState<Record<number, boolean>>({});
  const [expandAll, setExpandAll] = useState<boolean>(false);

  if (!lyrics || lyrics.lines.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center shadow-lg">
        <p className="text-neutral-500 text-sm">
          No normalized lyrics available. Retrieve a TTML track or select a JSON provider candidate above.
        </p>
      </div>
    );
  }

  const toggleExpand = (idx: number) => {
    setExpandedLines((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleToggleExpandAll = () => {
    const nextState = !expandAll;
    setExpandAll(nextState);
    if (nextState) {
      const all: Record<number, boolean> = {};
      lyrics.lines.forEach((_, i) => (all[i] = true));
      setExpandedLines(all);
    } else {
      setExpandedLines({});
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Normalized Lyric Stream</h2>
            <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-mono font-semibold">
              {lyrics.provider} ({lyrics.actualGranularity.toUpperCase()})
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Unified timeline with millisecond precision & syllable segment drilldown. Click any timestamp to seek.
          </p>
        </div>

        {lyrics.hasSubLineTiming && (
          <button
            onClick={handleToggleExpandAll}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs px-3 py-1.5 rounded-lg font-semibold transition self-start sm:self-auto"
          >
            {expandAll ? 'Collapse All Syllables' : 'Expand All Syllables'}
          </button>
        )}
      </div>

      {/* Lines stream */}
      <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1 custom-scrollbar">
        {lyrics.lines.map((line, idx) => {
          const isActive = activeLineIndex === idx;
          const isExpanded = expandAll || !!expandedLines[idx];
          const hasSegments = Boolean(line.segments && line.segments.length > 0);

          return (
            <div
              key={line.id || idx}
              className={`rounded-xl border transition-all duration-200 ${
                isActive
                  ? 'bg-purple-950/30 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/50'
                  : 'bg-black/40 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {/* Line Header & Text */}
              <div className="p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {/* Line Index & Expand trigger */}
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    {hasSegments ? (
                      <button
                        onClick={() => toggleExpand(idx)}
                        className="text-neutral-400 hover:text-white p-0.5 rounded"
                      >
                        {isExpanded ? (
                          <FaChevronDown className="text-xs text-purple-400" />
                        ) : (
                          <FaChevronRight className="text-xs" />
                        )}
                      </button>
                    ) : (
                      <div className="w-4" />
                    )}
                    <span className="text-neutral-500 font-mono text-xs w-6 text-right font-semibold">
                      {idx + 1}
                    </span>
                  </div>

                  {/* Text content & tags */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {line.songPart && (
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700/60">
                          {line.songPart}
                        </span>
                      )}
                      {line.isBackground && (
                        <span className="text-[10px] uppercase font-bold bg-blue-950/40 text-blue-400 px-1.5 py-0.5 rounded border border-blue-800/50">
                          Backing
                        </span>
                      )}
                      {hasSegments && (
                        <span className="text-[10px] text-purple-400 font-mono">
                          {line.segments?.length} segments
                        </span>
                      )}
                    </div>

                    {/* Main Lyric Text */}
                    <p
                      className={`text-base font-semibold leading-relaxed ${
                        isActive ? 'text-white' : 'text-neutral-200'
                      }`}
                    >
                      {line.text}
                    </p>
                  </div>
                </div>

                {/* Timing Pills & Seek Button */}
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <button
                    onClick={() => onSeek(line.startMs)}
                    title="Seek audio to line start"
                    className="flex items-center gap-1.5 bg-neutral-800/80 hover:bg-purple-900/60 hover:text-purple-200 text-neutral-300 font-mono text-xs px-2.5 py-1 rounded-lg border border-neutral-700/60 transition active:scale-95"
                  >
                    <FaPlay className="text-[9px] text-purple-400" />
                    {formatMsToClock(line.startMs)}
                  </button>

                  <span className="text-xs font-mono text-neutral-500 hidden sm:inline">
                    &rarr; {formatMsToClock(line.endMs)} ({line.durationMs}ms)
                  </span>
                </div>
              </div>

              {/* Expandable Syllable / Word Segment Breakdown */}
              {hasSegments && isExpanded && (
                <div className="px-4 pb-3 pt-1 border-t border-neutral-800/60 bg-black/30 rounded-b-xl">
                  <div className="text-[11px] font-semibold text-neutral-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                    <FaClock className="text-purple-400 text-[10px]" />
                    Syllable / Word Segment Breakdown:
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {line.segments?.map((seg, sIdx) => {
                      const isSegActive =
                        isActive &&
                        currentTimeMs >= seg.startMs &&
                        currentTimeMs <= seg.endMs;

                      return (
                        <button
                          key={sIdx}
                          onClick={() => onSeek(seg.startMs)}
                          className={`px-2 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1 border ${
                            isSegActive
                              ? 'bg-purple-600 border-purple-400 text-white font-bold shadow-[0_0_10px_rgba(168,85,247,0.4)] scale-105'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-600'
                          }`}
                          title={`Start: ${seg.startMs}ms, End: ${seg.endMs}ms (${seg.durationMs}ms)`}
                        >
                          <span className="font-sans font-semibold">{seg.text}</span>
                          <span className="text-[10px] text-neutral-400 opacity-80">
                            {seg.startMs}ms
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
