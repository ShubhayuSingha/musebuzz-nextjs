'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { HiMagnifyingGlass, HiPlus, HiChevronUpDown, HiCheck, HiXMark } from 'react-icons/hi2';

interface Album {
  id: string;
  title: string;
  image_path: string | null;
  genre: string | null;
  release_type: string;
}

interface AlbumSelectorProps {
  albums: Album[];
  selectedAlbum: Album | null;
  artistSelected: boolean;
  onSelectAlbum: (album: Album | null) => void;
  onOpenNewAlbumModal: () => void;
  isLoadingAlbums?: boolean;
}

export const AlbumSelector: React.FC<AlbumSelectorProps> = ({
  albums,
  selectedAlbum,
  artistSelected,
  onSelectAlbum,
  onOpenNewAlbumModal,
  isLoadingAlbums = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filteredAlbums = albums.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-y-1.5 w-full ${isOpen ? 'z-50' : 'z-10'}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-neutral-300">
          Album <span className="text-purple-400">*</span>
        </label>
        <button
          type="button"
          onClick={onOpenNewAlbumModal}
          disabled={!artistSelected}
          className="inline-flex items-center gap-1 text-xs font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-40 disabled:hover:text-purple-400 transition cursor-pointer"
        >
          <HiPlus className="w-3.5 h-3.5" /> New Album
        </button>
      </div>

      {/* Selected Box or Trigger */}
      <div
        onClick={() => {
          if (!artistSelected) return;
          setIsOpen(!isOpen);
        }}
        className={`relative w-full flex items-center justify-between bg-neutral-900 border rounded-xl px-3 py-2.5 transition select-none ${
          !artistSelected
            ? 'opacity-50 cursor-not-allowed border-neutral-800'
            : 'border-neutral-800 hover:border-neutral-700 focus-within:border-purple-500 cursor-pointer'
        }`}
      >
        {selectedAlbum ? (
          <div className="flex items-center gap-x-2.5 min-w-0">
            <div className="relative w-7 h-7 rounded-md overflow-hidden bg-neutral-800 shrink-0 border border-neutral-700">
              <Image
                src={
                  selectedAlbum.image_path
                    ? `https://zniinqiqnwndnowzzjyt.supabase.co/storage/v1/object/public/images/${selectedAlbum.image_path}`
                    : '/images/album_placeholder.svg'
                }
                alt={selectedAlbum.title}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white truncate">
                {selectedAlbum.title}
              </span>
              <span className="text-[10px] text-neutral-400 capitalize">
                {selectedAlbum.release_type} {selectedAlbum.genre ? `• ${selectedAlbum.genre}` : ''}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-sm text-neutral-500 font-normal">
            {!artistSelected
              ? 'Select an artist first...'
              : isLoadingAlbums
              ? 'Loading albums...'
              : 'Select or search an album...'}
          </span>
        )}

        <div className="flex items-center gap-x-1.5 text-neutral-400">
          {selectedAlbum && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAlbum(null);
              }}
              className="p-1 hover:text-white transition"
              title="Clear selection"
            >
              <HiXMark className="w-4 h-4" />
            </button>
          )}
          <HiChevronUpDown className="w-4 h-4 text-neutral-500" />
        </div>
      </div>

      {/* Dropdown Menu with Live Search */}
      {isOpen && artistSelected && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 overflow-hidden flex flex-col max-h-72 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/60">
          {/* Search Bar inside Dropdown */}
          <div className="p-2 border-b border-neutral-800 bg-neutral-950/50">
            <div className="relative flex items-center">
              <HiMagnifyingGlass className="absolute left-2.5 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search albums..."
                autoFocus
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-purple-500/70 transition"
              />
            </div>
          </div>

          {/* List of Albums */}
          <div className="overflow-y-auto divide-y divide-neutral-800/40 max-h-56 p-1">
            {filteredAlbums.length > 0 ? (
              filteredAlbums.map((album) => {
                const isSelected = selectedAlbum?.id === album.id;
                return (
                  <div
                    key={album.id}
                    onClick={() => {
                      onSelectAlbum(album);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                      isSelected
                        ? 'bg-purple-600/20 text-purple-300'
                        : 'hover:bg-neutral-800/70 text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-x-2.5 min-w-0">
                      <div className="relative w-7 h-7 rounded-md overflow-hidden bg-neutral-800 shrink-0 border border-neutral-700">
                        <Image
                          src={
                            album.image_path
                              ? `https://zniinqiqnwndnowzzjyt.supabase.co/storage/v1/object/public/images/${album.image_path}`
                              : '/images/album_placeholder.svg'
                          }
                          alt={album.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium truncate">{album.title}</span>
                        <span className="text-[10px] text-neutral-400 capitalize">
                          {album.release_type} {album.genre ? `• ${album.genre}` : ''}
                        </span>
                      </div>
                    </div>
                    {isSelected && <HiCheck className="w-4 h-4 text-purple-400 shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-neutral-500">
                {albums.length === 0 ? (
                  <>
                    This artist has no albums yet.
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenNewAlbumModal();
                        }}
                        className="text-purple-400 hover:underline font-semibold"
                      >
                        + Create the first album
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    No albums found matching &quot;{query}&quot;.
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenNewAlbumModal();
                        }}
                        className="text-purple-400 hover:underline font-semibold"
                      >
                        + Create &quot;{query}&quot; as a new album
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

