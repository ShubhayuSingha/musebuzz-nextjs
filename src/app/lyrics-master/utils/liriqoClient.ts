// src/app/lyrics-master/utils/liriqoClient.ts

import { LiriQoSearchResponse, LiriQoLyricsResponse, ResolvedRecording } from '../types/lyricsMaster.types';

const LIRIQO_BASE_URL = 'https://api.liriqo-alfarrizi.my.id/v1';
const DEFAULT_TIMEOUT_MS = 12000;

/**
 * Custom fetch wrapper with configurable timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err: unknown) {
    clearTimeout(id);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. The upstream service is taking too long to respond.`);
    }
    throw err;
  }
}

/**
 * Endpoint C: /search
 * Resolves song title and artist into a YouTube videoId and recording metadata.
 */
export async function resolveSongWithLiriQo(
  query: string,
  options?: { title?: string; artist?: string }
): Promise<{ success: boolean; data?: ResolvedRecording; error?: string; rawResponse?: unknown }> {
  try {
    let url = `${LIRIQO_BASE_URL}/search?`;
    if (options?.title && options?.artist) {
      url += `title=${encodeURIComponent(options.title)}&artist=${encodeURIComponent(options.artist)}`;
    } else {
      url += `Q=${encodeURIComponent(query)}`;
    }

    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return {
        success: false,
        error: `Search endpoint responded with status ${res.status}: ${res.statusText}`,
      };
    }

    const json: LiriQoSearchResponse = await res.json();
    if (!json.videoId) {
      return {
        success: false,
        error: json.error || 'No YouTube video ID found for this song query.',
        rawResponse: json,
      };
    }

    const resolved: ResolvedRecording = {
      videoId: json.videoId,
      source: json.source || 'youtube',
      title: json.metadata?.title || query,
      artist: json.metadata?.artist || options?.artist || 'Unknown Artist',
      album: json.metadata?.album || '',
      duration: json.metadata?.duration || '',
      rawMatchScore: json.matchScore,
    };

    return {
      success: true,
      data: resolved,
      rawResponse: json,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to reach LiriQo API.';
    return {
      success: false,
      error: `Network/Resolution error: ${errorMsg}`,
    };
  }
}

/**
 * Endpoint A: /ttml
 * Retrieves raw XML/TTML lyrics for the video ID.
 */
export async function fetchRawTTML(
  videoId: string
): Promise<{ success: boolean; xml?: string; status?: number; error?: string }> {
  try {
    const url = `${LIRIQO_BASE_URL}/ttml?v=${encodeURIComponent(videoId)}`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        error: `TTML request failed with HTTP ${res.status}: ${res.statusText}. No TTML track was served by upstream providers for video ID "${videoId}".`,
      };
    }

    const xml = await res.text();
    if (!xml || !xml.trim() || !xml.includes('<tt')) {
      return {
        success: false,
        status: res.status,
        error: 'TTML endpoint returned an empty or non-TTML response body.',
      };
    }

    return {
      success: true,
      status: res.status,
      xml,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network error';
    return {
      success: false,
      error: `Failed to fetch TTML: ${errorMsg}`,
    };
  }
}

/**
 * Endpoint B: /lyrics
 * Retrieves lyrics from multiple providers as JSON.
 */
export async function fetchJsonLyrics(
  videoId: string,
  debug: boolean = true
): Promise<{ success: boolean; data?: LiriQoLyricsResponse; error?: string }> {
  try {
    let url = `${LIRIQO_BASE_URL}/lyrics?v=${encodeURIComponent(videoId)}`;
    if (debug) url += '&debug=1';

    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return {
        success: false,
        error: `Lyrics endpoint responded with HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const json: LiriQoLyricsResponse = await res.json();
    return {
      success: true,
      data: json,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network error';
    return {
      success: false,
      error: `Failed to fetch JSON lyrics: ${errorMsg}`,
    };
  }
}

/**
 * Endpoint F: /health
 */
export async function checkLiriQoHealth(): Promise<{ ok: boolean; info?: unknown }> {
  try {
    const res = await fetchWithTimeout(`${LIRIQO_BASE_URL}/health`, {}, 5000);
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, info: data };
  } catch {
    return { ok: false };
  }
}
