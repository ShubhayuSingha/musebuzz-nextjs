// src/app/lyrics-master/utils/ttmlParser.ts

import { 
  UnifiedLyrics, 
  TimedLine, 
  TimedSegment, 
  TimingGranularity,
  TimingDiagnostics 
} from '../types/lyricsMaster.types';
import { parseTimestampToMs } from './timestampParser';

export interface TTMLParseResult {
  success: boolean;
  lyrics?: UnifiedLyrics;
  error?: string;
  declaredTiming?: string;
  detectedGranularity?: TimingGranularity;
  warningList: string[];
}

/**
 * Parses a raw TTML XML string into UnifiedLyrics with deep timing granularity analysis.
 */
export function parseTTML(xmlString: string, providerName: string = 'Apple Music (TTML)'): TTMLParseResult {
  const warnings: string[] = [];

  if (!xmlString || typeof xmlString !== 'string' || !xmlString.trim()) {
    return {
      success: false,
      error: 'Empty or invalid TTML content provided.',
      warningList: ['Input XML string was empty.'],
    };
  }

  // Guard for DOMParser availability (browser environment)
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return {
      success: false,
      error: 'DOMParser is not available in the current execution environment.',
      warningList: ['Must run inside a browser client context with DOMParser support.'],
    };
  }

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, 'application/xml');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error during parse';
    return {
      success: false,
      error: `XML Parser Exception: ${errorMsg}`,
      warningList: ['XML parsing failed.'],
    };
  }

  // Check for XML parsing error tag
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return {
      success: false,
      error: `Malformed XML: ${parseError.textContent?.slice(0, 200) || 'Syntax error'}`,
      warningList: ['Document contains XML syntax errors.'],
    };
  }

  const ttEl = doc.querySelector('tt') || doc.documentElement;
  if (!ttEl || ttEl.tagName.toLowerCase() !== 'tt') {
    return {
      success: false,
      error: 'Root element is not <tt>. This does not appear to be a valid TTML document.',
      warningList: ['Root element is missing or not <tt>.'],
    };
  }

  // Read root attributes
  const declaredTiming = 
    ttEl.getAttribute('itunes:timing') || 
    ttEl.getAttributeNS('http://music.apple.com/lyric-ttml-internal', 'timing') || 
    ttEl.getAttribute('timing') || 
    '';

  const xmlLang = 
    ttEl.getAttribute('xml:lang') || 
    ttEl.getAttribute('lang') || 
    '';

  // Read Songwriters from metadata
  const songwriterEls = doc.querySelectorAll('songwriters songwriter, metadata songwriter');
  const songwriters: string[] = [];
  songwriterEls.forEach(el => {
    const name = el.textContent?.trim();
    if (name && !songwriters.includes(name)) {
      songwriters.push(name);
    }
  });

  // Read leadingSilence
  const itunesMetadata = doc.querySelector('iTunesMetadata');
  const leadingSilenceStr = itunesMetadata?.getAttribute('leadingSilence');
  const leadingSilenceSec = leadingSilenceStr ? parseFloat(leadingSilenceStr) : undefined;

  // Traverse body and paragraphs (<p>)
  const pElements = doc.querySelectorAll('body p, div p, p');
  if (pElements.length === 0) {
    return {
      success: false,
      error: 'No lyric lines (<p> elements) found inside the TTML document.',
      declaredTiming,
      warningList: ['Document has valid XML structure but contains no <p> line elements.'],
    };
  }

  const lines: TimedLine[] = [];
  let totalSegments = 0;
  let syllableHyphenCount = 0;
  let hasAnySpansWithDistinctTiming = false;

  pElements.forEach((p, idx) => {
    const pBeginRaw = p.getAttribute('begin');
    const pEndRaw = p.getAttribute('end');
    const pKey = p.getAttribute('itunes:key') || p.getAttribute('key') || `L${idx + 1}`;
    const pAgent = p.getAttribute('ttm:agent') || p.getAttribute('agent') || '';
    const pRole = p.getAttribute('ttm:role') || p.getAttribute('role') || '';
    const isBackground = pRole.includes('bg') || pRole.includes('x-bg');

    // Check enclosing div for songPart
    const parentDiv = p.closest('div');
    const songPart = 
      parentDiv?.getAttribute('itunes:songPart') || 
      parentDiv?.getAttribute('songPart') || 
      undefined;

    const startMs = parseTimestampToMs(pBeginRaw);
    let endMs = parseTimestampToMs(pEndRaw);

    // If line has no end time, default to startMs + 3000ms until next line or segment resolves it
    if (endMs <= startMs && pBeginRaw) {
      warnings.push(`Line ${idx + 1} (${pKey}) has invalid or zero duration (${startMs}ms - ${endMs}ms).`);
      endMs = startMs + 3000;
    }

    // Inspect child spans
    const spanEls = p.querySelectorAll('span');
    const segments: TimedSegment[] = [];

    spanEls.forEach((span) => {
      const sBeginRaw = span.getAttribute('begin');
      const sEndRaw = span.getAttribute('end');
      const spanText = span.textContent || '';

      if (sBeginRaw) {
        const sStartMs = parseTimestampToMs(sBeginRaw);
        const sEndMs = sEndRaw ? parseTimestampToMs(sEndRaw) : sStartMs + 200;
        const durMs = Math.max(0, sEndMs - sStartMs);

        // Check if token indicates a syllable split (e.g. "Dy-", "na-", "ah-", "-ing")
        const cleanText = spanText.trim();
        const isSyllable = cleanText.endsWith('-') || cleanText.startsWith('-') || cleanText.endsWith('~');
        if (isSyllable) {
          syllableHyphenCount++;
        }

        segments.push({
          text: spanText,
          startMs: sStartMs,
          endMs: sEndMs,
          durationMs: durMs,
          isSyllablePart: isSyllable,
        });

        if (sStartMs !== startMs || sEndMs !== endMs) {
          hasAnySpansWithDistinctTiming = true;
        }
      }
    });

    if (segments.length > 0) {
      totalSegments += segments.length;
    }

    // Line text reconstruction
    const fullText = p.textContent?.replace(/\s+/g, ' ').trim() || '';

    lines.push({
      id: pKey || idx,
      lineIndex: idx,
      text: fullText,
      startMs,
      endMs,
      durationMs: Math.max(0, endMs - startMs),
      songPart,
      agent: pAgent || undefined,
      isBackground,
      key: pKey,
      segments: segments.length > 0 ? segments : undefined,
    });
  });

  // Calculate timing diagnostics
  const diagnostics = calculateDiagnostics(lines, totalSegments, warnings);

  // Granularity evaluation logic
  let actualGranularity: TimingGranularity = 'line';
  let granularityReason = '';
  let isGenuineSyllableSync = false;

  const declaredLower = declaredTiming.toLowerCase();

  if (declaredLower === 'line') {
    actualGranularity = 'line';
    granularityReason = 'Document explicitly declares itunes:timing="Line" on <tt> element.';
  } else if (totalSegments > 0 && hasAnySpansWithDistinctTiming) {
    if (syllableHyphenCount >= 3 || (declaredLower === 'syllable' && totalSegments > lines.length * 1.5)) {
      actualGranularity = 'syllable';
      isGenuineSyllableSync = true;
      granularityReason = `Genuine syllable-level timing verified with ${totalSegments} timed sub-segments and ${syllableHyphenCount} explicit syllable split markers.`;
    } else {
      actualGranularity = 'word';
      granularityReason = `Word-level timing verified with ${totalSegments} distinct timed word spans across ${lines.length} lines.`;
    }
  } else if (lines.length > 0 && lines.some(l => l.startMs > 0)) {
    actualGranularity = 'line';
    granularityReason = 'Only line-level <p> timestamps exist; no finer-grained <span> timestamps found.';
  } else {
    actualGranularity = 'plain';
    granularityReason = 'No usable start or end timestamps found in lines.';
  }

  const unifiedLyrics: UnifiedLyrics = {
    sourceFormat: 'ttml',
    provider: providerName,
    declaredSyncLevel: declaredTiming || 'Not Declared',
    actualGranularity,
    granularityReason,
    isGenuineSyllableSync,
    language: xmlLang || undefined,
    songwriters: songwriters.length > 0 ? songwriters : undefined,
    leadingSilenceSec,
    lines,
    hasSubLineTiming: actualGranularity === 'syllable' || actualGranularity === 'word',
    rawPayload: xmlString,
    diagnostics,
  };

  return {
    success: true,
    lyrics: unifiedLyrics,
    declaredTiming,
    detectedGranularity: actualGranularity,
    warningList: warnings,
  };
}

/**
 * Computes timing diagnostics over ordered lines
 */
function calculateDiagnostics(
  lines: TimedLine[], 
  totalSegments: number, 
  warnings: string[]
): TimingDiagnostics {
  if (lines.length === 0) {
    return {
      totalLines: 0,
      totalSegments: 0,
      firstLineStartMs: null,
      lastLineEndMs: null,
      totalLyricDurationMs: 0,
      hasOverlaps: false,
      overlappingLineIndices: [],
      hasGaps: false,
      negativeOrZeroDurationsCount: 0,
      nonMonotonicTimestampsCount: 0,
      warnings,
    };
  }

  const firstLineStartMs = lines[0].startMs;
  const lastLineEndMs = lines[lines.length - 1].endMs;
  const totalLyricDurationMs = Math.max(0, lastLineEndMs - firstLineStartMs);

  const overlappingIndices: number[] = [];
  let negativeOrZeroDurations = 0;
  let nonMonotonicCount = 0;
  let hasGaps = false;

  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];

    if (cur.durationMs <= 0) {
      negativeOrZeroDurations++;
    }

    if (i > 0) {
      const prev = lines[i - 1];

      // Check monotonicity
      if (cur.startMs < prev.startMs) {
        nonMonotonicCount++;
        warnings.push(`Line ${i + 1} starts (${cur.startMs}ms) before line ${i} (${prev.startMs}ms).`);
      }

      // Check overlap
      if (cur.startMs < prev.endMs && !cur.isBackground && !prev.isBackground) {
        overlappingIndices.push(i);
      }

      // Check long gaps (> 12 seconds between lines)
      if (cur.startMs - prev.endMs > 12000) {
        hasGaps = true;
      }
    }
  }

  return {
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
}
