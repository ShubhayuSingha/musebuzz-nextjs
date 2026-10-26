// src/app/lyrics-master/utils/jsonLyricsParser.ts

import { 
  LiriQoLyricsResponse, 
  LiriQoTrack, 
  CandidateTrackSummary, 
  UnifiedLyrics, 
  TimedLine, 
  TimedSegment, 
  TimingGranularity,
  TimingDiagnostics
} from '../types/lyricsMaster.types';
import { parseTimestampToMs } from './timestampParser';

/**
 * Evaluates the genuine timing granularity of a LiriQo track
 */
export function evaluateTrackGranularity(track: LiriQoTrack): {
  granularity: TimingGranularity;
  reason: string;
  isGenuineSyllable: boolean;
  subLineWordCount: number;
} {
  const syncDeclared = (track.syncLevel || '').toLowerCase();
  let subLineWordCount = 0;
  let syllableSplits = 0;

  // Check if track has timed lines
  if (!track.timed || !Array.isArray(track.timed) || track.timed.length === 0) {
    if (track.plain && typeof track.plain === 'string' && track.plain.trim().length > 0) {
      return {
        granularity: 'plain',
        reason: 'Track only contains plain untimed text.',
        isGenuineSyllable: false,
        subLineWordCount: 0,
      };
    }
    return {
      granularity: 'unsupported',
      reason: 'No timed lines or plain text found in this track.',
      isGenuineSyllable: false,
      subLineWordCount: 0,
    };
  }

  // Count subline tokens
  track.timed.forEach((line) => {
    if (Array.isArray(line.words)) {
      subLineWordCount += line.words.length;
      line.words.forEach((w) => {
        const clean = (w.text || '').trim();
        if (clean.endsWith('-') || clean.startsWith('-') || clean.endsWith('~')) {
          syllableSplits++;
        }
      });
    }
  });

  // Also check top-level track.words array if line.words was empty
  if (subLineWordCount === 0 && Array.isArray(track.words)) {
    track.words.forEach((lineWords) => {
      if (Array.isArray(lineWords)) {
        subLineWordCount += lineWords.length;
        lineWords.forEach((w) => {
          const clean = (w.text || '').trim();
          if (clean.endsWith('-') || clean.startsWith('-') || clean.endsWith('~')) {
            syllableSplits++;
          }
        });
      }
    });
  }

  // Syllable check
  if (syncDeclared === 'syllable') {
    if (subLineWordCount > 0) {
      return {
        granularity: 'syllable',
        reason: `Declared syllable sync with ${subLineWordCount} timed segments (${syllableSplits} explicit syllable split markers).`,
        isGenuineSyllable: true,
        subLineWordCount,
      };
    }
    return {
      granularity: 'line',
      reason: 'Track claimed "syllable" syncLevel, but no sub-line timed word tokens were present.',
      isGenuineSyllable: false,
      subLineWordCount: 0,
    };
  }

  // Word check
  if (syncDeclared === 'word' || subLineWordCount > 0) {
    if (subLineWordCount > 0) {
      return {
        granularity: 'word',
        reason: `Word-level sync confirmed with ${subLineWordCount} timed sub-segments.`,
        isGenuineSyllable: false,
        subLineWordCount,
      };
    }
    // lrclib_wordsync edge case: each line is a single word
    if (track.provider.includes('wordsync') && track.timed.length > 100) {
      return {
        granularity: 'word',
        reason: `High-frequency word sync with ${track.timed.length} one-word lines.`,
        isGenuineSyllable: false,
        subLineWordCount: track.timed.length,
      };
    }
  }

  // Line check
  if (track.timed.length > 0) {
    return {
      granularity: 'line',
      reason: `Line-level sync confirmed with ${track.timed.length} timed lines.`,
      isGenuineSyllable: false,
      subLineWordCount: 0,
    };
  }

  return {
    granularity: 'plain',
    reason: 'Untimed text only.',
    isGenuineSyllable: false,
    subLineWordCount: 0,
  };
}

/**
 * Summarizes all candidate tracks in the LiriQo response and orders them by timing quality
 */
export function analyzeCandidates(response: LiriQoLyricsResponse): CandidateTrackSummary[] {
  const tracks = response.tracks || (response.primary ? [response.primary] : []);
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return [];
  }

  const summaries: CandidateTrackSummary[] = tracks.map((track, idx) => {
    const evalResult = evaluateTrackGranularity(track);
    const hasEmbeddedTtml = Boolean(track.ttml && typeof track.ttml === 'string' && track.ttml.includes('<tt'));

    // Quality Score calculation for ranking
    let qualityScore = 0;
    if (evalResult.granularity === 'syllable') qualityScore = 400;
    else if (evalResult.granularity === 'word') qualityScore = 300;
    else if (evalResult.granularity === 'line') qualityScore = 200;
    else if (evalResult.granularity === 'plain') qualityScore = 100;

    // Bonus for rich providers with Apple Music data or embedded TTML
    if (hasEmbeddedTtml) qualityScore += 50;
    if (track.provider?.includes('apple_music')) qualityScore += 30;
    if (track.provider?.includes('lrclib_wordsync')) qualityScore += 10;

    return {
      index: idx,
      provider: track.provider || `track_${idx + 1}`,
      syncLevel: track.syncLevel || 'none',
      actualGranularity: evalResult.granularity,
      granularityReason: evalResult.reason,
      title: track.title || response.metadata?.title || 'Unknown',
      artist: track.artist || response.metadata?.artist || 'Unknown',
      album: track.album || response.metadata?.album || 'Unknown',
      timedLineCount: track.timed?.length || 0,
      subLineWordCount: evalResult.subLineWordCount,
      hasEmbeddedTtml,
      isRecommended: false,
      recommendationRank: qualityScore,
      recommendationReason: evalResult.reason,
      rawTrack: track,
    };
  });

  // Sort descending by qualityScore
  summaries.sort((a, b) => b.recommendationRank - a.recommendationRank);

  // Mark top candidate as recommended
  if (summaries.length > 0) {
    summaries[0].isRecommended = true;
    summaries[0].recommendationReason = `Top recommended candidate: Highest verified timing quality (${summaries[0].actualGranularity}).`;
  }

  return summaries;
}

/**
 * Converts a raw LiriQo track into the UnifiedLyrics representation
 */
export function normalizeJsonTrack(track: LiriQoTrack, originalPayloadString?: string): UnifiedLyrics {
  const evalResult = evaluateTrackGranularity(track);
  const warnings: string[] = [];

  const rawLines = track.timed || [];
  const lines: TimedLine[] = [];
  let totalSegments = 0;

  rawLines.forEach((item, idx) => {
    const startMs = parseTimestampToMs(item.start);
    let endMs = parseTimestampToMs(item.end);

    if (endMs <= startMs && item.start !== undefined) {
      endMs = startMs + 3000;
    }

    const segments: TimedSegment[] = [];

    // Extract word segments if available in line.words
    if (Array.isArray(item.words)) {
      item.words.forEach((w) => {
        const wStart = parseTimestampToMs(w.start);
        const wEnd = parseTimestampToMs(w.end);
        segments.push({
          text: w.text || '',
          startMs: wStart,
          endMs: wEnd,
          durationMs: Math.max(0, wEnd - wStart),
          isSyllablePart: (w.text || '').endsWith('-'),
        });
      });
    } else if (Array.isArray(track.words) && track.words[idx]) {
      // Top-level track.words[idx] fallback
      const wordList = track.words[idx];
      if (Array.isArray(wordList)) {
        wordList.forEach((w) => {
          const wStart = parseTimestampToMs(w.start);
          const wEnd = parseTimestampToMs(w.end);
          segments.push({
            text: w.text || '',
            startMs: wStart,
            endMs: wEnd,
            durationMs: Math.max(0, wEnd - wStart),
            isSyllablePart: (w.text || '').endsWith('-'),
          });
        });
      }
    }

    if (segments.length > 0) {
      totalSegments += segments.length;
    }

    lines.push({
      id: item.id || idx,
      lineIndex: idx,
      text: item.text || '',
      startMs,
      endMs,
      durationMs: Math.max(0, endMs - startMs),
      songPart: item.songPart || undefined,
      agent: item.agent || undefined,
      key: item.key || `L${idx + 1}`,
      segments: segments.length > 0 ? segments : undefined,
    });
  });

  // Calculate timing diagnostics
  const firstLineStartMs = lines.length > 0 ? lines[0].startMs : null;
  const lastLineEndMs = lines.length > 0 ? lines[lines.length - 1].endMs : null;
  const totalLyricDurationMs = (firstLineStartMs !== null && lastLineEndMs !== null) 
    ? Math.max(0, lastLineEndMs - firstLineStartMs) 
    : 0;

  const overlappingIndices: number[] = [];
  let negativeOrZeroDurations = 0;
  let nonMonotonicCount = 0;
  let hasGaps = false;

  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (cur.durationMs <= 0) negativeOrZeroDurations++;

    if (i > 0) {
      const prev = lines[i - 1];
      if (cur.startMs < prev.startMs) {
        nonMonotonicCount++;
        warnings.push(`Line ${i + 1} starts earlier than line ${i}.`);
      }
      if (cur.startMs < prev.endMs) {
        overlappingIndices.push(i);
      }
      if (cur.startMs - prev.endMs > 12000) {
        hasGaps = true;
      }
    }
  }

  const diagnostics: TimingDiagnostics = {
    totalLines: lines.length,
    totalSegments,
    firstLineStartMs,
    lastLineEndMs,
    totalLyricDurationMs,
    hasOverlaps: overlappingIndices.length > 0,
    overlappingLineIndices: overlappingIndices,
    hasGaps,
    negativeOrZeroDurationsCount: negativeOrZeroDurations,
    nonMonotonicTimestampsCount: nonMonotonicCount,
    warnings,
  };

  return {
    sourceFormat: 'json',
    provider: track.provider || 'LiriQo Track',
    declaredSyncLevel: track.syncLevel || 'none',
    actualGranularity: evalResult.granularity,
    granularityReason: evalResult.reason,
    isGenuineSyllableSync: evalResult.isGenuineSyllable,
    songMetadata: {
      title: track.title,
      artist: track.artist,
      album: track.album,
    },
    lines,
    hasSubLineTiming: evalResult.granularity === 'syllable' || evalResult.granularity === 'word',
    rawPayload: originalPayloadString || JSON.stringify(track, null, 2),
    diagnostics,
  };
}
