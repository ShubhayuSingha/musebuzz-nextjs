// src/app/lyrics-master/components/SongSearchPanel.tsx

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { DatabaseSong } from '../types/lyricsMaster.types';
import { formatSecondsToTime } from '../utils/timestampParser';
import { FaSearch, FaMusic, FaCheckCircle, FaClock, FaLanguage } from 'react-icons/fa';

interface SongSearchPanelProps {
  selectedSong: DatabaseSong | null;
  onSelectSong: (song: DatabaseSong) => void;
}

export const SongSearchPanel: React.FC<SongSearchPanelProps> = ({
  selectedSong,
  onSelectSong,
}) => {
  const [songs, setSongs] = useState<DatabaseSong[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch all songs on mount from Supabase
  useEffect(() => {
    async function loadCatalogue() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const { data, error } = await supabase
          .from('songs')
          .select('*, albums(*, artists(*))')
          .order('created_at', { ascending: false });

        if (error) {
          setFetchError(`Database query error: ${error.message}`);
        } else if (data) {
          setSongs(data as DatabaseSong[]);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setFetchError(`Failed to load songs: ${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
    }

    loadCatalogue();
  }, []);

  // Filter songs based on search query (title, artist, album, language)
  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return songs;
    const q = searchQuery.toLowerCase();

    return songs.filter((s) => {
      const titleMatch = (s.title || '').toLowerCase().includes(q);
      const artistMatch = (s.albums?.artists?.name || '').toLowerCase().includes(q);
      const albumMatch = (s.albums?.title || '').toLowerCase().includes(q);
      const langMatch = (s.language || '').toLowerCase().includes(q);
      return titleMatch || artistMatch || albumMatch || langMatch;
    });
  }, [songs, searchQuery]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaMusic className="text-purple-400 text-lg" />
            MuseBuzz Catalogue
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Select a database track to inspect and fetch synchronized lyrics
          </p>
        </div>
        <span className="text-xs font-mono bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-full border border-neutral-700">
          {filteredSongs.length} / {songs.length} tracks
        </span>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <FaSearch className="absolute left-3.5 top-3.5 text-neutral-500 text-sm" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by song title, artist, album..."
          className="w-full bg-black/60 border border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-xs text-neutral-400 hover:text-white px-1.5 py-0.5 rounded bg-neutral-800"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs mb-3">
          {fetchError}
        </div>
      )}

      {/* Songs list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[360px] min-h-[180px] custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-500 gap-2">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading database tracks...</span>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-10 text-neutral-500 text-sm">
            No matching songs found in catalogue.
          </div>
        ) : (
          filteredSongs.map((song) => {
            const isSelected = selectedSong?.id === song.id;
            const artistName = song.albums?.artists?.name || 'Unknown Artist';
            const albumTitle = song.albums?.title || 'Single';

            return (
              <div
                key={song.id}
                onClick={() => onSelectSong(song)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
                  isSelected
                    ? 'bg-purple-950/40 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                    : 'bg-black/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40'
                }`}
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`font-semibold text-sm truncate ${
                        isSelected ? 'text-purple-300' : 'text-neutral-200 group-hover:text-white'
                      }`}
                    >
                      {song.title}
                    </h3>
                    {isSelected && (
                      <span className="text-[10px] bg-purple-500 text-white font-bold px-1.5 py-0.5 rounded-full shrink-0">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">
                    {artistName} &bull; <span className="text-neutral-500">{albumTitle}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-right">
                  {song.language && (
                    <span className="text-[11px] text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700/60 hidden sm:inline-flex items-center gap-1">
                      <FaLanguage className="text-neutral-500 text-xs" />
                      {song.language}
                    </span>
                  )}
                  <span className="text-xs font-mono text-neutral-400 flex items-center gap-1">
                    <FaClock className="text-neutral-600 text-[10px]" />
                    {formatSecondsToTime(song.duration_seconds || 0)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected song footer indicator */}
      {selectedSong && (
        <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
          <span className="text-neutral-400 flex items-center gap-1.5 truncate">
            <FaCheckCircle className="text-emerald-400 shrink-0" />
            Selected DB ID: <code className="text-purple-300 font-mono text-[11px]">{selectedSong.id.slice(0, 8)}...</code>
          </span>
          <span className="text-neutral-500 font-mono text-[11px]">
            {selectedSong.song_path ? 'Audio file available' : 'No audio'}
          </span>
        </div>
      )}
    </div>
  );
};
