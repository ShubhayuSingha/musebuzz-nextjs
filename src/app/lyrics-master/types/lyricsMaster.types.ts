// src/app/lyrics-master/types/lyricsMaster.types.ts

/**
 * MuseBuzz Database Song Representation with relations
 */
export interface DatabaseSong {
  id: string;
  created_at: string;
  title: string;
  song_path: string;
  duration_seconds: number;
  album_id: string;
  language?: string;
  lyrics_snippet?: string;
  albums?: {
    id: string;
    title: string;
    image_path?: string;
    genre?: string;
    release_type?: 'album' | 'single';
    artists?: {
      id: string;
      name: string;
      image_path?: string;
    };
  };
}

/**
 * Timing Granularity Classification
 */
export type TimingGranularity = 'syllable' | 'word' | 'line' | 'plain' | 'unsupported';

/**
 * An individual timed word or syllable segment
 */
export interface TimedSegment {
  text: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  isSyllablePart?: boolean; // true if ends with hyphen or part of word
}

/**
 * A normalized lyric line
 */
export interface TimedLine {
  id: string | number;
  lineIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  songPart?: string;          // e.g. "Intro", "Verse", "Chorus", "Bridge", "Outro"
  agent?: string;             // e.g. "v1", "v2"
  isBackground?: boolean;     // e.g. ttm:role="x-bg"
  key?: string;               // e.g. "L1", "L2"
  segments?: TimedSegment[];  // Word- or syllable-level breakdown if available
}

/**
 * Timing Integrity Diagnostics
 */
export interface TimingDiagnostics {
  totalLines: number;
  totalSegments: number;
  firstLineStartMs: number | null;
  lastLineEndMs: number | null;
  totalLyricDurationMs: number;
  hasOverlaps: boolean;
  overlappingLineIndices: number[];
  hasGaps: boolean;
  negativeOrZeroDurationsCount: number;
  nonMonotonicTimestampsCount: number;
  warnings: string[];
}

/**
 * Complete Unified Normalized Lyric Object
 */
export interface UnifiedLyrics {
  sourceFormat: 'ttml' | 'json';
  provider: string;
  declaredSyncLevel?: string;
  actualGranularity: TimingGranularity;
  granularityReason: string;
  isGenuineSyllableSync: boolean;
  songMetadata?: {
    title?: string;
    artist?: string;
    album?: string;
  };
  language?: string;
  songwriters?: string[];
  leadingSilenceSec?: number;
  lines: TimedLine[];
  hasSubLineTiming: boolean;
  rawPayload: string;
  diagnostics: TimingDiagnostics;
}

/**
 * Recording Resolution Metadata & Match Assessment
 */
export interface ResolvedRecording {
  videoId: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSeconds?: number;
  rawMatchScore?: number;
}

export interface RecordingMatchAssessment {
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'WARNING';
  matchScorePercent: number;
  titleMatch: boolean;
  artistMatch: boolean;
  durationDifferenceSeconds: number | null;
  durationStatus: 'MATCH' | 'CLOSE' | 'MISMATCH' | 'UNKNOWN';
  warnings: string[];
  details: string[];
}

/**
 * Raw LiriQo API Interfaces
 */
export interface LiriQoSearchResponse {
  isVideoId?: boolean;
  videoId?: string;
  source?: string;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    duration?: string;
  };
  matchScore?: number;
  error?: string;
}

export interface LiriQoTimedWord {
  text: string;
  start: number;
  end: number;
}

export interface LiriQoTimedLine {
  id?: number | string;
  text: string;
  start: number;
  end: number;
  songPart?: string;
  agent?: string;
  key?: string;
  isCue?: boolean;
  isInstrumental?: boolean;
  words?: string | LiriQoTimedWord[];
}

export interface LiriQoTrack {
  provider: string;
  syncLevel?: string;
  title?: string;
  artist?: string;
  album?: string;
  plain?: string;
  timed?: LiriQoTimedLine[];
  words?: (LiriQoTimedWord[])[];
  translation?: unknown;
  ttml?: string;
  upstreamProvider?: string;
  [key: string]: unknown;
}

export interface LiriQoLyricsResponse {
  videoId: string;
  tookMs?: number;
  count?: number;
  primary?: LiriQoTrack;
  tracks?: LiriQoTrack[];
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    duration?: string;
  };
  error?: string;
}

/**
 * Track Candidate in the Selection Matrix
 */
export interface CandidateTrackSummary {
  index: number;
  provider: string;
  syncLevel: string;
  actualGranularity: TimingGranularity;
  granularityReason: string;
  title: string;
  artist: string;
  album: string;
  timedLineCount: number;
  subLineWordCount: number;
  hasEmbeddedTtml: boolean;
  isRecommended: boolean;
  recommendationRank: number;
  recommendationReason: string;
  rawTrack: LiriQoTrack;
}
