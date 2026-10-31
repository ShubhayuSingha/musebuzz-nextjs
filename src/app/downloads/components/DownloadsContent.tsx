// src/app/downloads/components/DownloadsContent.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useUser } from '@supabase/auth-helpers-react';
import { FiDownload, FiSearch } from 'react-icons/fi';
import { AiFillHeart } from 'react-icons/ai';
import { RiAlbumLine, RiPlayListFill } from 'react-icons/ri';
import { BsStars } from 'react-icons/bs';
import { HiArrowDownTray, HiChevronDown, HiCheck } from 'react-icons/hi2';
import { IoMdClose } from 'react-icons/io';
import { TbArrowsSort } from 'react-icons/tb';
import Fuse from 'fuse.js';

import { offlineDb } from '@/lib/offlineDb';
import useDownloadStore from '@/stores/useDownloadStore';
import usePlayerStore from '@/stores/usePlayerStore';
import usePlaylistStore from '@/stores/usePlaylistStore';
import MediaContextMenu from '@/components/MediaContextMenu';
import StorageIndicator from '@/components/StorageIndicator';
import MusicLoader from '@/components/MusicLoader';

export type SortOption = 'recents' | 'recently_added' | 'alphabetical' | 'creator';

const SORT_LABELS: Record<SortOption, string> = {
  recents: 'Recents',
  recently_added: 'Recently Added',
  alphabetical: 'Alphabetical',
  creator: 'Creator',
};

interface DownloadedItem {
  id: string;
  type: 'playlist' | 'album' | 'liked' | 'generated_playlist';
  title: string;
  subtitle: string;
  imageUrl: string | null;
  path: string;
  songsCount?: number;
  downloadedAt: number;
  last_accessed_at?: string;
}

export default function DownloadsContent() {
  const router = useRouter();
  const user = useUser();
  const userId = user?.id;

  const downloadedCount = useDownloadStore((state) => state.downloadedIds.size);
  const activeContext = usePlayerStore((state) => state.activeContext);
  const version = usePlaylistStore((state) => state.version);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DownloadedItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'playlist' | 'generated_playlist' | 'album'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recents');
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    if (sortOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sortOpen]);

  const loadDownloadedItems = useCallback(async () => {
    try {
      const results: DownloadedItem[] = [];

      // 1. Liked Songs Check (Only include if ACTUALLY downloaded to device)
      const isLikedDownloaded = useDownloadStore.getState().downloadedIds.has('liked');
      let likedRefCount = 0;
      if (offlineDb.song_references) {
        likedRefCount = userId
          ? await offlineDb.song_references.where('parent_type').equals('liked').filter(r => r.parent_id === userId).count()
          : await offlineDb.song_references.where('parent_type').equals('liked').count();
      }

      if (isLikedDownloaded || likedRefCount > 0) {
        const count = likedRefCount > 0 ? likedRefCount : (offlineDb.liked_songs && userId ? await offlineDb.liked_songs.where('user_id').equals(userId).count() : 0);
        if (count > 0) {
          results.push({
            id: 'liked',
            type: 'liked',
            title: 'Liked Songs',
            subtitle: `${count} ${count === 1 ? 'song' : 'songs'}`,
            imageUrl: null,
            path: '/liked',
            songsCount: count,
            downloadedAt: Date.now(),
            last_accessed_at: new Date().toISOString()
          });
        }
      }

      // 2. Playlists & Generated Mixes
      let userPlaylists = userId
        ? await offlineDb.playlists.where('user_id').equals(userId).toArray()
        : await offlineDb.playlists.toArray();

      if (userPlaylists.length === 0) {
        userPlaylists = await offlineDb.playlists.toArray();
      }

      for (const pl of userPlaylists) {
        if (pl.id === 'liked' || pl.id.startsWith('liked_')) continue;
        const isMix = (pl as any).is_mix || pl.image_url?.includes('mix-placeholder');
        let imageUrl = isMix ? '/images/mix-placeholder.png' : '/images/playlist-placeholder.jpg';
        if (pl.image_path && pl.image_url) {
          imageUrl = pl.image_url;
        } else if (pl.image_url) {
          imageUrl = pl.image_url.includes('playlist-placeholder') && isMix
            ? '/images/mix-placeholder.png'
            : pl.image_url;
        }
        const songCount = pl.playlist_songs?.length || 0;
        results.push({
          id: pl.id,
          type: isMix ? 'generated_playlist' : 'playlist',
          title: pl.title,
          subtitle: `${songCount} ${songCount === 1 ? 'song' : 'songs'}`,
          imageUrl,
          path: isMix ? `/mix/${pl.id}` : `/playlist/${pl.id}`,
          songsCount: songCount,
          downloadedAt: pl.downloaded_at || Date.now(),
          last_accessed_at: pl.last_accessed_at || new Date(pl.downloaded_at || Date.now()).toISOString(),
        });
      }

      // 3. Albums
      let albums: any[] = [];
      if (offlineDb.saved_albums && userId) {
        const userSaved = await offlineDb.saved_albums.where('user_id').equals(userId).toArray();
        let albumIds = userSaved.map(s => s.album_id);
        if (albumIds.length > 0) {
          albums = await offlineDb.albums.where('id').anyOf(albumIds).toArray();
        } else {
          albums = await offlineDb.albums.toArray();
        }
      } else {
        albums = await offlineDb.albums.toArray();
      }

      for (const alb of albums) {
        results.push({
          id: alb.id,
          type: 'album',
          title: alb.title,
          subtitle: alb.artists?.name || 'Album',
          imageUrl: alb.image_url || '/images/album-placeholder.png',
          path: `/album/${alb.id}`,
          songsCount: alb.songs?.length || 0,
          downloadedAt: alb.downloaded_at || Date.now(),
          last_accessed_at: alb.last_accessed_at || new Date(alb.downloaded_at || Date.now()).toISOString(),
        });
      }

      setItems(results);
    } catch (e) {
      console.warn('[DownloadsContent] Error loading downloads:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDownloadedItems();
  }, [userId, downloadedCount, version, loadDownloadedItems]);

  // Dynamic update when an item is played: instantly update last_accessed_at so it smoothly floats to top
  useEffect(() => {
    if (!activeContext?.id) return;
    const now = new Date().toISOString();
    setItems((prev) => {
      const exists = prev.some((it) => it.id === activeContext.id);
      if (!exists) return prev;
      return prev.map((it) => {
        if (it.id === activeContext.id) {
          return { ...it, last_accessed_at: now };
        }
        return it;
      });
    });
  }, [activeContext?.id]);

  // Category filter
  const categoryFilteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'playlist') {
      return items.filter(item => item.type === 'playlist' || item.type === 'liked');
    }
    return items.filter(item => item.type === filter);
  }, [items, filter]);

  // Sorting
  const sortedItems = useMemo(() => {
    return [...categoryFilteredItems].sort((a, b) => {
      if (sortBy === 'recents') {
        const timeA = new Date(a.last_accessed_at || a.downloadedAt || 0).getTime();
        const timeB = new Date(b.last_accessed_at || b.downloadedAt || 0).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'recently_added') {
        return b.downloadedAt - a.downloadedAt;
      }
      if (sortBy === 'alphabetical') {
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'creator') {
        return a.subtitle.localeCompare(b.subtitle, undefined, { sensitivity: 'base' });
      }
      return 0;
    });
  }, [categoryFilteredItems, sortBy]);

  // In-view fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(sortedItems, {
      keys: [
        { name: 'title', weight: 0.8 },
        { name: 'subtitle', weight: 0.2 }
      ],
      threshold: 0.25,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });
  }, [sortedItems]);

  const displayedItems = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return sortedItems;
    return fuse.search(q).map(res => res.item);
  }, [searchQuery, sortedItems, fuse]);

  return (
    <div className="bg-black h-full w-full overflow-hidden overflow-y-auto">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-b from-purple-950 via-zinc-950 to-black p-4 sm:p-8 border-b border-neutral-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-2xl flex-shrink-0">
              <FiDownload size={34} className="text-white drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-widest text-purple-400">Offline Library</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                Downloads
              </h1>
              <p className="text-sm text-neutral-400 mt-1 max-w-xl">
                Music downloaded directly to this device. Play anytime, even without internet.
              </p>
            </div>
          </div>

          {/* Storage usage widget */}
          <div className="w-full md:w-72 bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-3 shadow-lg">
            <StorageIndicator variant="menu" />
          </div>
        </div>

        {/* Filter Pills + In-View Fuzzy Search & Sort Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-6">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {(['all', 'playlist', 'generated_playlist', 'album'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`
                  px-4 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5
                  ${filter === tab
                    ? 'bg-white text-black shadow'
                    : 'bg-neutral-800/80 text-neutral-300 hover:text-white hover:bg-neutral-700/80 border border-neutral-700/60'}
                `}
              >
                {tab === 'all' 
                  ? 'All Downloads' 
                  : tab === 'playlist' 
                  ? 'Playlists' 
                  : tab === 'generated_playlist'
                  ? 'Made For You'
                  : 'Albums'}
              </button>
            ))}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* In-View Fuzzy Search Bar */}
            <div className="relative flex-1 sm:w-60 md:w-64 flex-shrink-0">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  filter === 'all' 
                    ? 'Search in downloads...' 
                    : filter === 'generated_playlist'
                    ? 'Search mixes...'
                    : `Search in ${filter}s...`
                }
                className="w-full bg-neutral-900/90 text-white placeholder-neutral-500 text-xs rounded-full pl-9 pr-8 py-2 border border-neutral-800 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40 transition font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded-full hover:bg-neutral-800 transition cursor-pointer"
                  aria-label="Clear search"
                >
                  <IoMdClose size={14} />
                </button>
              )}
            </div>

            {/* Sleek Sort Dropdown */}
            <div className="relative shrink-0" ref={sortMenuRef}>
              <button
                type="button"
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-medium transition cursor-pointer"
                title="Sort downloads"
              >
                <TbArrowsSort size={14} className="text-neutral-400" />
                <span className="hidden sm:inline">{SORT_LABELS[sortBy]}</span>
                <HiChevronDown size={13} className={`text-neutral-400 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortOpen && (
                <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl py-1.5 z-50">
                  {(['recents', 'recently_added', 'alphabetical', 'creator'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSortBy(opt);
                        setSortOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-left transition cursor-pointer ${
                        sortBy === opt ? 'text-purple-400 bg-purple-500/10' : 'text-neutral-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>{SORT_LABELS[opt]}</span>
                      {sortBy === opt && <HiCheck size={14} className="text-purple-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT GRID */}
      <div className="p-4 sm:p-8">
        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <MusicLoader label="Loading downloads..." size="md" />
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-4">
              <HiArrowDownTray size={28} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {searchQuery ? 'No matching downloads found' : 'No downloaded music found'}
            </h3>
            <p className="text-sm text-neutral-400 max-w-md mb-6">
              {searchQuery
                ? `No downloads match "${searchQuery}" in ${filter === 'all' ? 'your downloads' : filter === 'generated_playlist' ? 'Made For You' : filter + 's'}.`
                : `You haven't downloaded any ${filter === 'all' ? 'music' : filter === 'playlist' ? 'playlists' : filter === 'generated_playlist' ? 'mixes' : 'albums'} yet. Tap the download button on any album, playlist, or mix to save it for offline listening.`}
            </p>
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="px-6 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs transition cursor-pointer"
              >
                Clear search
              </button>
            ) : (
              <Link
                href="/"
                className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:scale-105 active:scale-95 transition"
              >
                Explore Music
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-4 sm:gap-5">
            {displayedItems.map((item) => (
              <motion.div
                key={`${item.type}-${item.id}`}
                layout="position"
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="h-full"
              >
                <MediaContextMenu
                  data={{
                    id: item.id,
                    type: item.type as any,
                    title: item.title,
                  }}
                >
                  <div
                    onClick={() => router.push(item.path)}
                    className="group bg-neutral-900/60 hover:bg-neutral-800/60 p-3 sm:p-4 rounded-xl border border-neutral-800/80 hover:border-neutral-700/80 transition-colors duration-200 cursor-pointer flex flex-col h-full"
                  >
                    {/* Media Cover / Image */}
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-md mb-3 bg-neutral-800">
                      {item.type === 'liked' ? (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-500 flex items-center justify-center">
                          <AiFillHeart size={44} className="text-white drop-shadow-md" />
                        </div>
                      ) : (
                        <Image
                          unoptimized
                          src={item.imageUrl || (item.type === 'album' ? '/images/album-placeholder.png' : item.type === 'generated_playlist' ? '/images/mix-placeholder.png' : '/images/playlist-placeholder.jpg')}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>

                    {/* Title & Subtitle with Clean Spacing & Tooltips */}
                    <div className="flex flex-col gap-1 min-w-0 mt-auto">
                      <h4 className="font-semibold text-white text-sm truncate" title={item.title}>
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                        {item.type === 'album' && <RiAlbumLine size={13} className="shrink-0 text-neutral-400" />}
                        {item.type === 'playlist' && <RiPlayListFill size={13} className="shrink-0 text-neutral-400" />}
                        {item.type === 'generated_playlist' && <BsStars size={13} className="shrink-0 text-purple-400" />}
                        {item.type === 'liked' && <AiFillHeart size={13} className="shrink-0 text-purple-400" />}
                        <span className="truncate" title={item.subtitle}>{item.subtitle}</span>
                      </div>
                    </div>
                  </div>
                </MediaContextMenu>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
