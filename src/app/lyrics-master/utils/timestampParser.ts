// src/app/lyrics-master/utils/timestampParser.ts

/**
 * Parses any supported timestamp representation into integer milliseconds.
 * 
 * Supports:
 * 1. Clock format: "00:01:19.710" (hours:minutes:seconds.fraction)
 * 2. Short clock: "1:19.710" or "01:19.710" (minutes:seconds.fraction)
 * 3. Decimal seconds: "79.710" or "0.200"
 * 4. Numeric milliseconds: 79710 or "79710"
 * 
 * @param input - The raw timestamp string or number
 * @returns Milliseconds as an integer, or 0 if invalid
 */
export function parseTimestampToMs(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;

  if (typeof input === 'number') {
    if (isNaN(input)) return 0;
    // If it's already an integer number >= 1000 (typical LiriQo JSON milliseconds), return rounded
    return Math.round(input);
  }

  const str = String(input).trim();
  if (!str) return 0;

  // Handle clock format: contains colons (e.g., "00:02:15.300" or "2:15.300")
  if (str.includes(':')) {
    const parts = str.split(':');
    if (parts.length === 3) {
      // hh:mm:ss.fraction
      const hours = parseFloat(parts[0]) || 0;
      const minutes = parseFloat(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
    } else if (parts.length === 2) {
      // mm:ss.fraction
      const minutes = parseFloat(parts[0]) || 0;
      const seconds = parseFloat(parts[1]) || 0;
      return Math.round((minutes * 60 + seconds) * 1000);
    }
  }

  // Handle purely numeric string or decimal seconds
  const numericVal = parseFloat(str);
  if (isNaN(numericVal)) return 0;

  // If there's a decimal dot and the magnitude is small or clearly seconds (e.g. "0.200", "59.612", "180.2")
  // In TTML, decimal numbers are seconds.
  // In JSON, timestamps without dot are already integer milliseconds.
  if (str.includes('.')) {
    return Math.round(numericVal * 1000);
  }

  // If it's an integer string: if > 10000 it's likely milliseconds.
  return Math.round(numericVal);
}

/**
 * Formats milliseconds into a standard Apple Music-style clock string: "mm:ss.mmm"
 */
export function formatMsToClock(ms: number): string {
  if (isNaN(ms) || ms < 0) return '00:00.000';

  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const minStr = String(minutes).padStart(2, '0');
  const secStr = seconds.toFixed(3).padStart(6, '0'); // includes 2 digits before dot and 3 after

  return `${minStr}:${secStr}`;
}

/**
 * Formats milliseconds into a clean display timestamp: "m:ss" or "mm:ss"
 */
export function formatMsToSimpleTime(ms: number): string {
  if (isNaN(ms) || ms < 0) return '0:00';

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats duration in seconds to "m:ss"
 */
export function formatSecondsToTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
