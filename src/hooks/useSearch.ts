// src/hooks/useSearch.ts
import { useEffect, useState, useRef } from "react";
import MiniSearch from "minisearch";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@supabase/auth-helpers-react";
import { offlineDb } from "@/lib/offlineDb";
import useOfflineModeStore from "@/stores/useOfflineModeStore";
import { withTimeout } from "@/lib/helpers";

export interface SearchSong {
  id: string;
  title: string;
  song_path: string;
  album_id?: string;
  language?: string;
  tags?: string[];
  imageUrl?: string | null;
  lyrics_snippet?: string | null;
  matchedLyricsSnippet?: string;
  score?: number;
  albums?: {
    id: string;
    title: string;
    image_path?: string | null;
    image_url?: string | null;
    genre?: string | null;
    artists?: {
      id?: string;
      name: string;
    };
  };
}

export interface SearchAlbum {
  id: string;
  title: string;
  image_path?: string | null;
  image_url?: string | null;
  genre?: string | null;
  score?: number;
  artists?: {
    id?: string;
    name: string;
  };
}

export interface SearchArtist {
  id: string;
  name: string;
  image_path?: string | null;
  image_url?: string | null;
  score?: number;
}

export interface SearchPlaylist {
  id: string;
  title: string;
  description?: string;
  _unified_image?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  _itemType: 'playlist' | 'mix';
  song_ids?: string[];
  user_id?: string;
  score?: number;
}

export interface TopResultItem {
  id: string;
  type: 'song' | 'album' | 'artist' | 'playlist' | 'mix';
  title: string;
  subtitle: string;
  image_path?: string | null;
  image_url?: string | null;
  score: number;
  matchedLyricsSnippet?: string;
  raw: any;
}

export interface DynamicSection {
  type: 'songs' | 'albums' | 'artists' | 'playlists';
  title: string;
  items: any[];
  maxScore: number;
}

export interface SearchResultsData {
  songs: SearchSong[];
  albums: SearchAlbum[];
  artists: SearchArtist[];
  playlists: SearchPlaylist[];
}

/**
 * Normalizes text for matching (lowercases, strips excess punctuation, trims).
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses and returns clean text lines from a lyrics_snippet JSON string.
 */
function extractCleanLyricsLines(lyricsSnippetJson: string | null | undefined): string[] {
  if (!lyricsSnippetJson) return [];
  try {
    const lines = typeof lyricsSnippetJson === 'string' ? JSON.parse(lyricsSnippetJson) : lyricsSnippetJson;
    if (!Array.isArray(lines)) return [];
    return lines
      .map((l: any) => {
        const raw = l.text || l.text_romanized || l.text_native || '';
        return typeof raw === 'string' ? raw.trim() : '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Checks a song's lyrics_snippet for matching phrases across single and adjacent lines.
 */
export function matchLyricsSnippet(
  lyricsSnippetJson: string | null | undefined,
  query: string
): { matched: boolean; snippet?: string; score: number } {
  if (!lyricsSnippetJson || !query) return { matched: false, score: 0 };
  const cleanedLines = extractCleanLyricsLines(lyricsSnippetJson);
  if (cleanedLines.length === 0) return { matched: false, score: 0 };

  const normQuery = normalizeText(query);
  if (!normQuery) return { matched: false, score: 0 };

  // 1. Single-line check
  for (let i = 0; i < cleanedLines.length; i++) {
    const originalLine = cleanedLines[i];
    const normLine = normalizeText(originalLine);
    if (normLine.includes(normQuery)) {
      return {
        matched: true,
        snippet: originalLine,
        score: normLine === normQuery ? 80 : 70
      };
    }
  }

  // 2. Cross-line check (pair of consecutive adjacent lines)
  for (let i = 0; i < cleanedLines.length - 1; i++) {
    const combinedPair = `${cleanedLines[i]} ${cleanedLines[i + 1]}`;
    const normPair = normalizeText(combinedPair);
    if (normPair.includes(normQuery)) {
      return {
        matched: true,
        snippet: `${cleanedLines[i]} / ${cleanedLines[i + 1]}`,
        score: 65
      };
    }
  }

  // 3. Triplet cross-line check
  if (cleanedLines.length > 2) {
    for (let i = 0; i < cleanedLines.length - 2; i++) {
      const combinedTrio = `${cleanedLines[i]} ${cleanedLines[i + 1]} ${cleanedLines[i + 2]}`;
      const normTrio = normalizeText(combinedTrio);
      if (normTrio.includes(normQuery)) {
        return {
          matched: true,
          snippet: `${cleanedLines[i]} / ${cleanedLines[i + 1]} / ${cleanedLines[i + 2]}`,
          score: 60
        };
      }
    }
  }

  // 4. Token co-occurrence check
  const tokens = normQuery.split(' ').filter((t) => t.length > 1);
  if (tokens.length > 1) {
    const fullLyrics = normalizeText(cleanedLines.join(' '));
    const allFound = tokens.every((tok) => fullLyrics.includes(tok));
    if (allFound) {
      const firstMatchingLine = cleanedLines.find((l) => normalizeText(l).includes(tokens[0])) || cleanedLines[0];
      return {
        matched: true,
        snippet: firstMatchingLine,
        score: 50
      };
    }
  }

  return { matched: false, score: 0 };
}

export const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with'
]);

interface MiniDoc {
  id: string;
  itemType: 'song' | 'artist' | 'album' | 'playlist';
  title: string;
  artist: string;
  album: string;
  lyrics: string;
  genre: string;
  language: string;
}

/**
 * Executes on-demand search against Supabase directly (Online).
 * Employs Unified Multi-Entity Compound Querying:
 * Automatically queries songs by title, lyrics, and joined artist/album tokens.
 */
async function queryOnlineDatabase(rawQuery: string, userId?: string): Promise<SearchResultsData> {
  const trimmed = rawQuery.trim();
  if (!trimmed) return { songs: [], albums: [], artists: [], playlists: [] };

  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const safeFull = trimmed.replace(/[%_\\(),]/g, ' ').trim();

  // Exclude common stop words from individual token filters so "the" doesn't query all artists!
  const nonStopTokens = tokens
    .map((t) => t.replace(/[%_\\(),]/g, '').trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

  const significantTokens = (nonStopTokens.length > 0
    ? nonStopTokens
    : tokens.map((t) => t.replace(/[%_\\(),]/g, '').trim()).filter((t) => t.length > 1)
  ).slice(0, 4);

  if (significantTokens.length === 0 && safeFull) {
    significantTokens.push(safeFull);
  }

  // 1. Build Song Filters
  const songFilters = [
    `title.ilike.%${safeFull}%`,
    `lyrics_snippet.ilike.%${safeFull}%`
  ];
  for (const tok of significantTokens) {
    songFilters.push(`title.ilike.%${tok}%`);
    songFilters.push(`language.ilike.%${tok}%`);
    songFilters.push(`lyrics_snippet.ilike.%${tok}%`);
  }

  // 2. Build Album Filters
  const albumFilters = [`title.ilike.%${safeFull}%`, `genre.ilike.%${safeFull}%`];
  for (const tok of significantTokens) {
    albumFilters.push(`title.ilike.%${tok}%`);
    albumFilters.push(`genre.ilike.%${tok}%`);
  }

  // 3. Build Artist Filters (Only search artist by token if it's NOT a stop-word!)
  const artistFilters = [`name.ilike.%${safeFull}%`];
  for (const tok of significantTokens) {
    if (!STOP_WORDS.has(tok)) {
      artistFilters.push(`name.ilike.%${tok}%`);
    }
  }

  try {
    const queries: any[] = [
      // Direct song matches (title, lyrics, language)
      supabase
        .from('songs')
        .select('id, title, song_path, album_id, language, tags, lyrics_snippet, albums(id, title, image_path, genre, artists(id, name))')
        .or(songFilters.join(','))
        .limit(40),

      // Albums
      supabase
        .from('albums')
        .select('id, title, image_path, genre, artists(id, name)')
        .or(albumFilters.join(','))
        .limit(10),

      // Artists
      supabase
        .from('artists')
        .select('id, name, image_path')
        .or(artistFilters.join(','))
        .limit(6)
    ];

    if (userId) {
      const plFilters = [`title.ilike.%${safeFull}%`, `description.ilike.%${safeFull}%`];
      for (const tok of significantTokens) {
        plFilters.push(`title.ilike.%${tok}%`);
        plFilters.push(`description.ilike.%${tok}%`);
      }

      queries.push(
        supabase
          .from('playlists')
          .select('id, title, description, image_path, user_id')
          .eq('user_id', userId)
          .or(plFilters.join(','))
          .limit(6)
      );
      queries.push(
        supabase
          .from('generated_playlists')
          .select('id, title, description, image_url, user_id, song_ids')
          .eq('user_id', userId)
          .or(plFilters.join(','))
          .limit(6)
      );
    }

    const results = await withTimeout(Promise.all(queries), 4500);

    let rawSongs: SearchSong[] = results[0]?.data || [];
    const rawAlbums: SearchAlbum[] = results[1]?.data || [];
    const rawArtists: SearchArtist[] = results[2]?.data || [];

    // 🟢 COMPOUND CROSS-ENTITY QUERY:
    // If the query matched an Artist (e.g. "Taylor Swift"), fetch their songs to merge into candidates!
    // This allows compound queries like "taylor swift we are never" to find the songs of that artist!
    if (rawArtists.length > 0) {
      const artistNames = rawArtists.map((a) => a.name.replace(/[%_\\(),]/g, ''));
      const artistSongFilters = artistNames.map((n) => `name.ilike.%${n}%`);

      const { data: artistSongs } = await supabase
        .from('songs')
        .select('id, title, song_path, album_id, language, tags, lyrics_snippet, albums!inner(id, title, image_path, genre, artists!inner(id, name))')
        .or(artistSongFilters.join(','), { referencedTable: 'albums.artists' })
        .limit(35);

      if (artistSongs && artistSongs.length > 0) {
        const existingIds = new Set(rawSongs.map((s) => s.id));
        for (const as of artistSongs) {
          if (!existingIds.has(as.id)) {
            rawSongs.push(as as any);
            existingIds.add(as.id);
          }
        }
      }
    }

    const rawPlaylists: SearchPlaylist[] = [];
    if (userId) {
      if ('liked songs'.includes(trimmed.toLowerCase()) || trimmed.toLowerCase().includes('like')) {
        rawPlaylists.push({
          id: 'liked',
          title: 'Liked Songs',
          description: 'Your favorite tracks',
          _unified_image: '/images/liked.png',
          _itemType: 'playlist',
          user_id: userId
        });
      }

      const userPlaylists = results[3]?.data || [];
      const userMixes = results[4]?.data || [];

      userPlaylists.forEach((p: any) => {
        rawPlaylists.push({ ...p, _unified_image: p.image_path, _itemType: 'playlist' });
      });

      userMixes.forEach((m: any) => {
        rawPlaylists.push({ ...m, _unified_image: m.image_url, _itemType: 'mix' });
      });
    }

    return {
      songs: rawSongs,
      albums: rawAlbums,
      artists: rawArtists,
      playlists: rawPlaylists
    };
  } catch (err) {
    console.warn("[useSearch] Online query failed, falling back to local database:", err);
    return queryOfflineDatabase(rawQuery, userId);
  }
}

/**
 * Executes on-demand search against IndexedDB (Offline mode).
 * Reads directly on search, zero items cached in RAM.
 */
async function queryOfflineDatabase(rawQuery: string, userId?: string): Promise<SearchResultsData> {
  const normQuery = normalizeText(rawQuery);
  if (!normQuery) return { songs: [], albums: [], artists: [], playlists: [] };

  try {
    const [offlineSongs, offlineAlbums, offlinePlaylists] = await Promise.all([
      offlineDb.songs.toArray(),
      offlineDb.albums.toArray(),
      offlineDb.playlists.toArray()
    ]);

    // Format unique artists from offlineAlbums
    const artistMap = new Map<string, SearchArtist>();
    for (const a of offlineAlbums) {
      if (a.artists?.name) {
        const artObj: SearchArtist = {
          id: a.artists.id || a.artists.name,
          name: a.artists.name,
          image_path: a.image_path,
          image_url: a.image_url
        };
        artistMap.set(artObj.id, artObj);
      }
    }

    // Filter Playlists for user
    let playlists = offlinePlaylists;
    if (userId) {
      playlists = playlists.filter((p) => !p.user_id || p.user_id === userId);
    }
    const rawPlaylists: SearchPlaylist[] = [];
    if ('liked songs'.includes(normQuery) || normQuery.includes('like')) {
      rawPlaylists.push({
        id: 'liked',
        title: 'Liked Songs',
        description: 'Your favorite tracks',
        _unified_image: '/images/liked.png',
        _itemType: 'playlist',
        user_id: userId
      });
    }

    for (const p of playlists) {
      if (p.id === 'liked' || p.id.startsWith('liked_')) continue;
      rawPlaylists.push({
        id: p.id,
        title: p.title,
        image_path: p.image_path,
        image_url: p.image_url,
        _unified_image: p.image_url || p.image_path,
        _itemType: 'playlist',
        user_id: p.user_id
      });
    }

    return {
      songs: offlineSongs as any,
      albums: offlineAlbums as any,
      artists: Array.from(artistMap.values()),
      playlists: rawPlaylists
    };
  } catch (e) {
    console.warn("[useSearch] Offline read failed:", e);
    return { songs: [], albums: [], artists: [], playlists: [] };
  }
}

/**
 * Scores and dynamically structures search results by relevance using Okapi BM25 (MiniSearch).
 */
function processAndRankResults(
  data: SearchResultsData,
  rawQuery: string
): {
  scoredSongs: SearchSong[];
  scoredAlbums: SearchAlbum[];
  scoredArtists: SearchArtist[];
  scoredPlaylists: SearchPlaylist[];
  topResult: TopResultItem | null;
  dynamicSections: DynamicSection[];
} {
  const normQuery = normalizeText(rawQuery);
  if (!normQuery) {
    return {
      scoredSongs: [],
      scoredAlbums: [],
      scoredArtists: [],
      scoredPlaylists: [],
      topResult: null,
      dynamicSections: []
    };
  }

  const qTokens = normQuery.split(/\s+/).filter(Boolean);
  const nonStop = qTokens.filter((t) => !STOP_WORDS.has(t));
  const activeStopWords = nonStop.length > 0 ? STOP_WORDS : new Set<string>();

  // 1. Initialize MiniSearch with BM25 Okapi configuration
  const miniSearch = new MiniSearch<MiniDoc>({
    fields: ['title', 'artist', 'album', 'lyrics', 'genre', 'language'],
    storeFields: ['itemType'],
    processTerm: (term) => {
      const lower = term.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!lower || activeStopWords.has(lower)) return null;
      return lower;
    },
    searchOptions: {
      boost: {
        title: 4.0,     // Direct title is highest priority
        artist: 3.5,    // Artist name
        lyrics: 2.8,    // Lyrics snippet / phrase
        album: 2.0,     // Album title
        genre: 1.2,     // Genre
        language: 1.0   // Language
      },
      prefix: true,     // Prefix matching for typing
      fuzzy: 0.2,       // Fuzzy tolerance for slight typos
      combineWith: 'OR'
    }
  });

  const docs: MiniDoc[] = [];

  data.songs.forEach((s) => {
    const lyricsLines = extractCleanLyricsLines(s.lyrics_snippet);
    docs.push({
      id: `song_${s.id}`,
      itemType: 'song',
      title: s.title || '',
      artist: s.albums?.artists?.name || '',
      album: s.albums?.title || '',
      lyrics: lyricsLines.join(' '),
      genre: s.albums?.genre || '',
      language: s.language || ''
    });
  });

  data.artists.forEach((a) => {
    docs.push({
      id: `artist_${a.id}`,
      itemType: 'artist',
      title: a.name || '',
      artist: a.name || '',
      album: '',
      lyrics: '',
      genre: '',
      language: ''
    });
  });

  data.albums.forEach((alb) => {
    docs.push({
      id: `album_${alb.id}`,
      itemType: 'album',
      title: alb.title || '',
      artist: alb.artists?.name || '',
      album: alb.title || '',
      lyrics: '',
      genre: alb.genre || '',
      language: ''
    });
  });

  data.playlists.forEach((pl) => {
    docs.push({
      id: `playlist_${pl.id}`,
      itemType: 'playlist',
      title: pl.title || '',
      artist: '',
      album: '',
      lyrics: pl.description || '',
      genre: '',
      language: ''
    });
  });

  if (docs.length > 0) {
    miniSearch.addAll(docs);
  }

  const hits = miniSearch.search(rawQuery);
  const hitMap = new Map<string, number>();
  for (const h of hits) {
    hitMap.set(h.id, h.score);
  }

  // 2. Score Songs (BM25 score + phrase & lyrics bonuses)
  const scoredSongs: SearchSong[] = data.songs
    .map((song) => {
      const baseScore = hitMap.get(`song_${song.id}`) || 0;
      const lyricsCheck = matchLyricsSnippet(song.lyrics_snippet, rawQuery);
      let bonus = 0;
      const normTitle = normalizeText(song.title);

      if (normTitle === normQuery) bonus += 60;
      else if (normTitle.startsWith(normQuery)) bonus += 35;
      else if (normTitle.includes(normQuery)) bonus += 20;

      if (lyricsCheck.matched) {
        bonus += lyricsCheck.score;
      }

      const totalScore = baseScore + bonus;
      return {
        ...song,
        score: totalScore,
        matchedLyricsSnippet: lyricsCheck.matched ? lyricsCheck.snippet : undefined
      };
    })
    .filter((s) => (s.score || 0) > 0);

  scoredSongs.sort((a, b) => (b.score || 0) - (a.score || 0));

  // 3. Score Artists
  const scoredArtists: SearchArtist[] = data.artists
    .map((art) => {
      const baseScore = hitMap.get(`artist_${art.id}`) || 0;
      let bonus = 0;
      const normName = normalizeText(art.name);

      if (normName === normQuery) bonus += 65;
      else if (normName.startsWith(normQuery)) bonus += 40;
      else if (normName.includes(normQuery)) bonus += 20;

      const totalScore = baseScore + bonus;
      return { ...art, score: totalScore };
    })
    .filter((a) => (a.score || 0) > 0);

  scoredArtists.sort((a, b) => (b.score || 0) - (a.score || 0));

  // 4. Score Albums
  const scoredAlbums: SearchAlbum[] = data.albums
    .map((alb) => {
      const baseScore = hitMap.get(`album_${alb.id}`) || 0;
      let bonus = 0;
      const normTitle = normalizeText(alb.title);

      if (normTitle === normQuery) bonus += 55;
      else if (normTitle.startsWith(normQuery)) bonus += 30;
      else if (normTitle.includes(normQuery)) bonus += 15;

      const totalScore = baseScore + bonus;
      return { ...alb, score: totalScore };
    })
    .filter((a) => (a.score || 0) > 0);

  scoredAlbums.sort((a, b) => (b.score || 0) - (a.score || 0));

  // 5. Score Playlists
  const scoredPlaylists: SearchPlaylist[] = data.playlists
    .map((pl) => {
      const baseScore = hitMap.get(`playlist_${pl.id}`) || 0;
      let bonus = 0;
      const normTitle = normalizeText(pl.title);

      if (normTitle === normQuery) bonus += 50;
      else if (normTitle.startsWith(normQuery)) bonus += 25;
      else if (normTitle.includes(normQuery)) bonus += 15;

      const totalScore = baseScore + bonus;
      return { ...pl, score: totalScore };
    })
    .filter((p) => (p.score || 0) > 0);

  scoredPlaylists.sort((a, b) => (b.score || 0) - (a.score || 0));

  // 6. Determine the single overall "Top Result" (Best Match)
  const candidateTop: TopResultItem[] = [];

  if (scoredSongs.length > 0) {
    const topSong = scoredSongs[0];
    candidateTop.push({
      id: topSong.id,
      type: 'song',
      title: topSong.title,
      subtitle: topSong.albums?.artists?.name ? `Song • ${topSong.albums.artists.name}` : 'Song',
      image_path: topSong.albums?.image_path,
      image_url: topSong.imageUrl || topSong.albums?.image_url,
      score: topSong.score || 0,
      matchedLyricsSnippet: topSong.matchedLyricsSnippet,
      raw: topSong
    });
  }

  if (scoredArtists.length > 0) {
    const topArt = scoredArtists[0];
    candidateTop.push({
      id: topArt.id,
      type: 'artist',
      title: topArt.name,
      subtitle: 'Artist',
      image_path: topArt.image_path,
      image_url: topArt.image_url,
      score: topArt.score || 0, // Pure relevance, zero artificial bias
      raw: topArt
    });
  }

  if (scoredAlbums.length > 0) {
    const topAlb = scoredAlbums[0];
    candidateTop.push({
      id: topAlb.id,
      type: 'album',
      title: topAlb.title,
      subtitle: topAlb.artists?.name ? `Album • ${topAlb.artists.name}` : 'Album',
      image_path: topAlb.image_path,
      image_url: topAlb.image_url,
      score: topAlb.score || 0,
      raw: topAlb
    });
  }

  if (scoredPlaylists.length > 0) {
    const topPl = scoredPlaylists[0];
    candidateTop.push({
      id: topPl.id,
      type: topPl._itemType === 'mix' ? 'mix' : 'playlist',
      title: topPl.title,
      subtitle: topPl._itemType === 'mix' ? 'Generated Mix' : 'Playlist',
      image_path: topPl.image_path,
      image_url: topPl._unified_image || topPl.image_url,
      score: topPl.score || 0,
      raw: topPl
    });
  }

  candidateTop.sort((a, b) => b.score - a.score);
  const topResult = candidateTop.length > 0 && candidateTop[0].score >= 20 ? candidateTop[0] : null;

  // 7. Dynamic Sections, ordered by each section's highest BM25 score
  const sections: DynamicSection[] = [];

  if (scoredSongs.length > 0) {
    sections.push({
      type: 'songs',
      title: 'Songs',
      items: scoredSongs.slice(0, 50),
      maxScore: scoredSongs[0].score || 0
    });
  }

  if (scoredAlbums.length > 0) {
    sections.push({
      type: 'albums',
      title: 'Albums',
      items: scoredAlbums.slice(0, 6),
      maxScore: scoredAlbums[0].score || 0
    });
  }

  if (scoredArtists.length > 0) {
    const nonTopArtists = topResult && topResult.type === 'artist'
      ? scoredArtists.filter((a) => a.id !== topResult.id)
      : scoredArtists;

    if (nonTopArtists.length > 0) {
      sections.push({
        type: 'artists',
        title: 'Artists',
        items: nonTopArtists.slice(0, 5),
        maxScore: nonTopArtists[0].score || 0
      });
    }
  }

  if (scoredPlaylists.length > 0) {
    sections.push({
      type: 'playlists',
      title: 'Playlists',
      items: scoredPlaylists.slice(0, 5),
      maxScore: scoredPlaylists[0].score || 0
    });
  }

  // Dynamic ranking: the section containing the highest matching score appears first!
  sections.sort((a, b) => b.maxScore - a.maxScore);

  return {
    scoredSongs,
    scoredAlbums,
    scoredArtists,
    scoredPlaylists,
    topResult,
    dynamicSections: sections
  };
}

/**
 * Modern Database-Backed Search Hook:
 * - 400ms Debounce
 * - 0 RAM Catalog Storage
 * - Approach B: Unified Document & Compound Multi-Entity Matching
 * - Works identically Online and Offline
 * - Cross-line lyrics matching
 * - Dynamic relevance-based sections & Top Result
 */
export const useSearch = (query = "") => {
  const user = useUser();
  const userId = user?.id;
  const { isOnline, isOfflineMode } = useOfflineModeStore();

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultsData>({
    songs: [],
    albums: [],
    artists: [],
    playlists: []
  });
  const [topResult, setTopResult] = useState<TopResultItem | null>(null);
  const [dynamicSections, setDynamicSections] = useState<DynamicSection[]>([]);

  const activeSearchIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ songs: [], albums: [], artists: [], playlists: [] });
      setTopResult(null);
      setDynamicSections([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const currentSearchId = ++activeSearchIdRef.current;

    // 400ms Debounce before querying database
    const timer = setTimeout(async () => {
      try {
        const effectivelyOffline =
          !isOnline ||
          isOfflineMode ||
          (typeof navigator !== 'undefined' && !navigator.onLine);

        let data: SearchResultsData;
        if (effectivelyOffline) {
          data = await queryOfflineDatabase(trimmed, userId);
        } else {
          data = await queryOnlineDatabase(trimmed, userId);
        }

        if (activeSearchIdRef.current !== currentSearchId) return;

        const ranked = processAndRankResults(data, trimmed);

        setResults({
          songs: ranked.scoredSongs,
          albums: ranked.scoredAlbums,
          artists: ranked.scoredArtists,
          playlists: ranked.scoredPlaylists
        });
        setTopResult(ranked.topResult);
        setDynamicSections(ranked.dynamicSections);
      } catch (err) {
        console.warn("[useSearch] Query error:", err);
      } finally {
        if (activeSearchIdRef.current === currentSearchId) {
          setIsLoading(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [query, isOnline, isOfflineMode, userId]);

  const hasResults = Boolean(
    topResult ||
    results.songs.length > 0 ||
    results.albums.length > 0 ||
    results.artists.length > 0 ||
    results.playlists.length > 0
  );

  return {
    results,
    topResult,
    dynamicSections,
    isLoading,
    hasResults,
    songs: results.songs,
    albums: results.albums,
    artists: results.artists,
    playlists: results.playlists
  };
};
