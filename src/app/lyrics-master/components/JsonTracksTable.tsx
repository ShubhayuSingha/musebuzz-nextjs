// src/app/lyrics-master/components/JsonTracksTable.tsx

'use client';

import React from 'react';
import { CandidateTrackSummary } from '../types/lyricsMaster.types';
import { 
  FaLayerGroup, 
  FaCheckCircle, 
  FaStar, 
  FaCode, 
  FaCheck, 
  FaApple 
} from 'react-icons/fa';

interface JsonTracksTableProps {
  candidates: CandidateTrackSummary[];
  selectedCandidateIndex: number | null;
  onSelectCandidate: (index: number) => void;
  onViewRawJson: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export const JsonTracksTable: React.FC<JsonTracksTableProps> = ({
  candidates,
  selectedCandidateIndex,
  onSelectCandidate,
  onViewRawJson,
  isLoading,
  errorMessage,
}) => {
  const getGranularityBadge = (granularity: string) => {
    switch (granularity) {
      case 'syllable':
        return (
          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
            <FaCheckCircle className="text-[9px]" /> Syllable
          </span>
        );
      case 'word':
        return (
          <span className="bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[11px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
            <FaCheckCircle className="text-[9px]" /> Word
          </span>
        );
      case 'line':
        return (
          <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
            Line
          </span>
        );
      default:
        return (
          <span className="bg-neutral-800 text-neutral-400 text-[11px] px-2 py-0.5 rounded-full">
            Plain
          </span>
        );
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaLayerGroup className="text-indigo-400 text-lg" />
            JSON Provider Candidate Matrix
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Compare all upstream providers returned by /lyrics and select candidate
          </p>
        </div>

        {candidates.length > 0 && (
          <button
            onClick={onViewRawJson}
            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <FaCode className="text-xs" />
            View Raw JSON
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-amber-300 text-xs mb-3">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 text-neutral-500 gap-2">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Fetching & parsing multi-provider lyrics...</span>
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-xs">
          No JSON lyrics retrieved yet. Click <span className="text-purple-400 font-semibold">&quot;2. Fetch JSON&quot;</span> to query upstream providers.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold text-[11px] bg-neutral-950/60">
                <th className="py-2.5 px-3">Select</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3">Declared Sync</th>
                <th className="py-2.5 px-3">Genuine Granularity</th>
                <th className="py-2.5 px-3">Lines / Words</th>
                <th className="py-2.5 px-3">Embedded TTML</th>
                <th className="py-2.5 px-3">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {candidates.map((c) => {
                const isSelected = selectedCandidateIndex === c.index;
                const isApple = c.provider.toLowerCase().includes('apple_music');

                return (
                  <tr
                    key={c.index}
                    onClick={() => onSelectCandidate(c.index)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-950/40 text-white'
                        : 'hover:bg-neutral-800/40 text-neutral-300'
                    }`}
                  >
                    {/* Radio Select */}
                    <td className="py-3 px-3">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-purple-400 bg-purple-600' : 'border-neutral-600 bg-neutral-800'
                      }`}>
                        {isSelected && <FaCheck className="text-[9px] text-white" />}
                      </div>
                    </td>

                    {/* Provider */}
                    <td className="py-3 px-3 font-semibold font-mono flex items-center gap-1.5">
                      {isApple && <FaApple className="text-neutral-300 shrink-0" />}
                      <span className={isSelected ? 'text-purple-300 font-bold' : 'text-neutral-200'}>
                        {c.provider}
                      </span>
                    </td>

                    {/* Declared sync */}
                    <td className="py-3 px-3 font-mono text-neutral-400">
                      {c.syncLevel}
                    </td>

                    {/* Genuine Granularity */}
                    <td className="py-3 px-3">
                      {getGranularityBadge(c.actualGranularity)}
                    </td>

                    {/* Lines & Words */}
                    <td className="py-3 px-3 font-mono">
                      <span className="text-neutral-200 font-semibold">{c.timedLineCount}</span> lines
                      {c.subLineWordCount > 0 && (
                        <span className="text-purple-400 font-semibold ml-1.5">
                          ({c.subLineWordCount} words)
                        </span>
                      )}
                    </td>

                    {/* Embedded TTML */}
                    <td className="py-3 px-3">
                      {c.hasEmbeddedTtml ? (
                        <span className="text-[11px] bg-green-950/40 border border-green-800/60 text-green-400 px-2 py-0.5 rounded font-mono">
                          Yes (TTML)
                        </span>
                      ) : (
                        <span className="text-neutral-600 font-mono">No</span>
                      )}
                    </td>

                    {/* Recommendation Rationale */}
                    <td className="py-3 px-3">
                      {c.isRecommended ? (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 text-[11px]">
                          <FaStar className="text-[9px] text-amber-400" /> Auto Recommended
                        </span>
                      ) : (
                        <span className="text-neutral-500 truncate max-w-[200px] block" title={c.granularityReason}>
                          {c.granularityReason}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
