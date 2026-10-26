// src/app/lyrics-master/components/MetricsSummaryCard.tsx

'use client';

import React from 'react';
import { UnifiedLyrics } from '../types/lyricsMaster.types';
import { 
  FaChartPie, 
  FaCheckCircle, 
  FaExclamationTriangle 
} from 'react-icons/fa';

interface MetricsSummaryCardProps {
  lyrics: UnifiedLyrics | null;
  songDurationSeconds?: number;
}

export const MetricsSummaryCard: React.FC<MetricsSummaryCardProps> = ({
  lyrics,
  songDurationSeconds,
}) => {
  if (!lyrics) return null;

  const totalLines = lyrics.lines.length;
  const totalSegments = lyrics.diagnostics.totalSegments;
  const hasSubline = lyrics.hasSubLineTiming;

  // Syllable / Subline Density: average segments per line
  const density = totalLines > 0 ? (totalSegments / totalLines).toFixed(1) : '0';

  // Lead-in intro time
  const leadInSec = lyrics.diagnostics.firstLineStartMs !== null 
    ? (lyrics.diagnostics.firstLineStartMs / 1000).toFixed(2)
    : 'N/A';

  // Total lyric span
  const lyricSpanSec = (lyrics.diagnostics.totalLyricDurationMs / 1000).toFixed(1);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaChartPie className="text-purple-400 text-lg" />
            Synchronization & Quality Metrics
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Key diagnostic indicators to evaluate retrieval fidelity before production integration
          </p>
        </div>

        <span className={`text-xs px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
          lyrics.isGenuineSyllableSync
            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
            : lyrics.actualGranularity === 'word'
            ? 'bg-blue-950/40 text-blue-400 border-blue-800/60'
            : 'bg-amber-950/40 text-amber-400 border-amber-800/60'
        }`}>
          {lyrics.isGenuineSyllableSync ? (
            <>
              <FaCheckCircle className="text-[10px]" /> Syllable-Grade
            </>
          ) : (
            <>
              <FaExclamationTriangle className="text-[10px]" /> {lyrics.actualGranularity.toUpperCase()}-Grade
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Metric 1: Total Timed Units */}
        <div className="bg-black/40 border border-neutral-800 p-3 rounded-xl text-center">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase">Timed Units</div>
          <div className="text-xl font-bold text-white font-mono mt-1">
            {totalLines + totalSegments}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {totalLines} lines + {totalSegments} sub-spans
          </div>
        </div>

        {/* Metric 2: Subline Timing Density */}
        <div className="bg-black/40 border border-neutral-800 p-3 rounded-xl text-center">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase">Subline Density</div>
          <div className="text-xl font-bold text-purple-400 font-mono mt-1">
            {density} <span className="text-xs text-neutral-400">seg/line</span>
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {hasSubline ? 'Fine-grained sync' : 'Line-only timing'}
          </div>
        </div>

        {/* Metric 3: Lead-in Silence */}
        <div className="bg-black/40 border border-neutral-800 p-3 rounded-xl text-center">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase">First Line Onset</div>
          <div className="text-xl font-bold text-neutral-200 font-mono mt-1">
            {leadInSec}s
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            Initial instrumental lead-in
          </div>
        </div>

        {/* Metric 4: Total Lyric Span */}
        <div className="bg-black/40 border border-neutral-800 p-3 rounded-xl text-center">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase">Lyric Window</div>
          <div className="text-xl font-bold text-neutral-200 font-mono mt-1">
            {lyricSpanSec}s
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {songDurationSeconds ? `Song length: ${songDurationSeconds}s` : 'Active lyric span'}
          </div>
        </div>

        {/* Metric 5: Overlaps & Gaps */}
        <div className="bg-black/40 border border-neutral-800 p-3 rounded-xl text-center col-span-2 md:col-span-1">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase">Overlap Anomalies</div>
          <div className={`text-xl font-bold font-mono mt-1 ${
            lyrics.diagnostics.hasOverlaps ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {lyrics.diagnostics.overlappingLineIndices.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {lyrics.diagnostics.hasOverlaps ? 'Overlapping lines present' : 'Clean line sequence'}
          </div>
        </div>
      </div>
    </div>
  );
};
