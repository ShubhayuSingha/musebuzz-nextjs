// src/app/lyrics-master/utils/recordingMatcher.ts

import { DatabaseSong, ResolvedRecording, RecordingMatchAssessment } from '../types/lyricsMaster.types';
import { parseTimestampToMs } from './timestampParser';

/**
 * Compares a MuseBuzz database song record with an externally resolved recording from LiriQo.
 */
export function assessRecordingMatch(
  dbSong: DatabaseSong,
  resolved: ResolvedRecording
): RecordingMatchAssessment {
  const warnings: string[] = [];
  const details: string[] = [];

  const dbTitle = (dbSong.title || '').trim().toLowerCase();
  const dbArtist = (dbSong.albums?.artists?.name || '').trim().toLowerCase();
  const resTitle = (resolved.title || '').trim().toLowerCase();
  const resArtist = (resolved.artist || '').trim().toLowerCase();

  // 1. Title Similarity
  const cleanDbTitle = dbTitle.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
  const cleanResTitle = resTitle.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
  const titleMatch = cleanResTitle.includes(cleanDbTitle) || cleanDbTitle.includes(cleanResTitle);

  if (titleMatch) {
    details.push(`Title matches: "${dbSong.title}" ≈ "${resolved.title}"`);
  } else {
    warnings.push(`Title mismatch: Database has "${dbSong.title}", resolved is "${resolved.title}".`);
  }

  // 2. Artist Similarity
  const artistMatch = 
    !dbArtist || 
    !resArtist || 
    resArtist.includes(dbArtist) || 
    dbArtist.includes(resArtist);

  if (artistMatch && dbArtist && resArtist) {
    details.push(`Artist matches: "${dbSong.albums?.artists?.name}" ≈ "${resolved.artist}"`);
  } else if (dbArtist && resArtist) {
    warnings.push(`Artist mismatch: Database has "${dbSong.albums?.artists?.name}", resolved has "${resolved.artist}".`);
  }

  // 3. Duration Comparison
  let resDurationSeconds: number | null = null;
  if (resolved.duration) {
    const parsedMs = parseTimestampToMs(resolved.duration);
    if (parsedMs > 0) {
      resDurationSeconds = Math.round(parsedMs / 1000);
    }
  }

  let durationDiffSec: number | null = null;
  let durationStatus: 'MATCH' | 'CLOSE' | 'MISMATCH' | 'UNKNOWN' = 'UNKNOWN';

  if (dbSong.duration_seconds && resDurationSeconds) {
    durationDiffSec = Math.abs(dbSong.duration_seconds - resDurationSeconds);

    if (durationDiffSec <= 3) {
      durationStatus = 'MATCH';
      details.push(`Duration aligned: DB (${dbSong.duration_seconds}s) vs Resolved (${resDurationSeconds}s), diff: ${durationDiffSec}s.`);
    } else if (durationDiffSec <= 8) {
      durationStatus = 'CLOSE';
      warnings.push(`Minor duration drift: DB (${dbSong.duration_seconds}s) vs Resolved (${resDurationSeconds}s), diff: ${durationDiffSec}s.`);
    } else {
      durationStatus = 'MISMATCH';
      warnings.push(
        `Substantial duration difference: ${durationDiffSec}s gap (DB: ${dbSong.duration_seconds}s vs Resolved: ${resDurationSeconds}s). Audio sync may fail if this is a music video, radio edit, or alternate version.`
      );
    }
  } else {
    details.push('Duration verification unavailable (external recording did not supply explicit duration metadata).');
  }

  // 4. Version / Modifier Keywords
  const riskyKeywords = [
    { word: 'live', label: 'Live recording' },
    { word: 'remix', label: 'Remix' },
    { word: 'acoustic', label: 'Acoustic rendition' },
    { word: 'instrumental', label: 'Instrumental version' },
    { word: 'cover', label: 'Cover version' },
    { word: 'slowed', label: 'Slowed / Reverb version' },
    { word: 'speed up', label: 'Sped-up version' },
    { word: 'orchestral', label: 'Orchestral arrangement' },
    { word: 'demo', label: 'Demo recording' },
  ];

  for (const { word, label } of riskyKeywords) {
    const dbHas = dbTitle.includes(word);
    const resHas = resTitle.includes(word);

    if (resHas && !dbHas) {
      warnings.push(`Resolved recording appears to be a ${label} ("${word}" in title), which may desynchronize from your catalog audio.`);
    }
  }

  // 5. Overall Confidence Calculation
  let matchScore = 0;
  if (titleMatch) matchScore += 50;
  if (artistMatch) matchScore += 30;
  if (durationStatus === 'MATCH') matchScore += 20;
  else if (durationStatus === 'CLOSE') matchScore += 10;
  else if (durationStatus === 'MISMATCH') matchScore -= 25;

  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'WARNING' = 'LOW';
  if (durationStatus === 'MISMATCH' || warnings.some(w => w.includes('appears to be a'))) {
    confidence = 'WARNING';
  } else if (matchScore >= 80) {
    confidence = 'HIGH';
  } else if (matchScore >= 50) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  return {
    confidence,
    matchScorePercent: Math.max(0, Math.min(100, matchScore)),
    titleMatch,
    artistMatch,
    durationDifferenceSeconds: durationDiffSec,
    durationStatus,
    warnings,
    details,
  };
}
