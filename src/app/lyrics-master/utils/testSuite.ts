// src/app/lyrics-master/utils/testSuite.ts

import { parseTimestampToMs, formatMsToClock } from './timestampParser';
import { evaluateTrackGranularity, analyzeCandidates } from './jsonLyricsParser';
import { assessRecordingMatch } from './recordingMatcher';
import { DatabaseSong, ResolvedRecording, LiriQoLyricsResponse } from '../types/lyricsMaster.types';

export function runLyricsMasterSelfTest(): {
  allPassed: boolean;
  total: number;
  passed: number;
  failed: number;
  results: { testName: string; passed: boolean; message?: string }[];
} {
  const results: { testName: string; passed: boolean; message?: string }[] = [];

  function assert(testName: string, condition: boolean, message?: string) {
    results.push({
      testName,
      passed: condition,
      message: condition ? undefined : message || 'Assertion failed',
    });
  }

  // --- 1. Timestamp Parsing Tests ---
  assert(
    'Parse standard TTML clock hh:mm:ss.mmm',
    parseTimestampToMs('00:00:19.710') === 19710,
    `Expected 19710, got ${parseTimestampToMs('00:00:19.710')}`
  );

  assert(
    'Parse short TTML clock m:ss.mmm',
    parseTimestampToMs('1:00.443') === 60443,
    `Expected 60443, got ${parseTimestampToMs('1:00.443')}`
  );

  assert(
    'Parse decimal seconds 0.200',
    parseTimestampToMs('0.200') === 200,
    `Expected 200, got ${parseTimestampToMs('0.200')}`
  );

  assert(
    'Parse decimal seconds 59.612',
    parseTimestampToMs('59.612') === 59612,
    `Expected 59612, got ${parseTimestampToMs('59.612')}`
  );

  assert(
    'Parse JSON numeric milliseconds 19780',
    parseTimestampToMs(19780) === 19780,
    `Expected 19780, got ${parseTimestampToMs(19780)}`
  );

  assert(
    'Format milliseconds to clock 01:00.443',
    formatMsToClock(60443) === '01:00.443',
    `Expected 01:00.443, got ${formatMsToClock(60443)}`
  );

  // --- 2. Track Granularity & Candidate Ranking Tests ---
  const mockSyllableTrack = {
    provider: 'golyrics_apple_music',
    syncLevel: 'syllable',
    timed: [
      {
        text: 'Dy- na- na- na',
        start: 200,
        end: 3000,
        words: [
          { text: 'Dy-', start: 200, end: 500 },
          { text: 'na-', start: 500, end: 800 },
          { text: 'na-', start: 800, end: 1200 },
          { text: 'na', start: 1200, end: 2000 },
        ],
      },
    ],
  };

  const evalSyllable = evaluateTrackGranularity(mockSyllableTrack);
  assert(
    'Detect genuine syllable sync with hyphenated tokens',
    evalSyllable.granularity === 'syllable' && evalSyllable.isGenuineSyllable,
    `Expected syllable, got ${evalSyllable.granularity}`
  );

  const mockFakeSyllableTrack = {
    provider: 'fake_provider',
    syncLevel: 'syllable',
    timed: [
      {
        text: 'This line has no words array',
        start: 200,
        end: 3000,
      },
    ],
  };

  const evalFake = evaluateTrackGranularity(mockFakeSyllableTrack);
  assert(
    'Downgrade claimed syllable sync if words array is missing',
    evalFake.granularity === 'line' && !evalFake.isGenuineSyllable,
    `Expected line, got ${evalFake.granularity}`
  );

  const mockResponse: LiriQoLyricsResponse = {
    videoId: 'test_vid',
    tracks: [
      {
        provider: 'ytm_line',
        syncLevel: 'line',
        timed: [{ text: 'Line 1', start: 0, end: 3000 }],
      },
      mockSyllableTrack,
    ],
  };

  const candidates = analyzeCandidates(mockResponse);
  assert(
    'Rank syllable provider higher than line provider',
    candidates.length === 2 && candidates[0].provider === 'golyrics_apple_music' && candidates[0].isRecommended,
    `Expected golyrics_apple_music at rank 0, got ${candidates[0]?.provider}`
  );

  // --- 3. Recording Match Assessment Tests ---
  const dbSong: DatabaseSong = {
    id: 'db-1',
    created_at: '2026-01-01',
    title: 'Dynamite',
    song_path: 'dynamite.mp3',
    duration_seconds: 199,
    album_id: 'alb-1',
    albums: {
      id: 'alb-1',
      title: 'BE',
      artists: { id: 'art-1', name: 'BTS' },
    },
  };

  const resolvedGood: ResolvedRecording = {
    videoId: 'HaEYUJ2aRHs',
    source: 'youtube',
    title: 'Dynamite',
    artist: 'BTS',
    album: 'BE',
    duration: '03:19',
    rawMatchScore: 1,
  };

  const assessmentGood = assessRecordingMatch(dbSong, resolvedGood);
  assert(
    'Accurately classify matching recording as HIGH confidence',
    assessmentGood.confidence === 'HIGH' && assessmentGood.titleMatch,
    `Expected HIGH confidence, got ${assessmentGood.confidence}`
  );

  const resolvedLive: ResolvedRecording = {
    videoId: 'live_123',
    source: 'youtube',
    title: 'Dynamite (Live at Tiny Desk)',
    artist: 'BTS',
    album: '',
    duration: '04:45', // 285s vs 199s (86s difference)
  };

  const assessmentLive = assessRecordingMatch(dbSong, resolvedLive);
  assert(
    'Flag live version and duration mismatch as WARNING',
    assessmentLive.confidence === 'WARNING' && assessmentLive.warnings.length > 0,
    `Expected WARNING for live version, got ${assessmentLive.confidence}`
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    allPassed: failed === 0,
    total: results.length,
    passed,
    failed,
    results,
  };
}
