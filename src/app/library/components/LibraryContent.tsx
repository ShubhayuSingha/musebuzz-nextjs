// src/app/library/components/LibraryContent.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { AiFillHeart } from "react-icons/ai";
import { RiAlbumLine, RiPlayListFill } from "react-icons/ri"; 
import { BsPersonFill, BsStars } from "react-icons/bs";
import { HiArrowDownTray, HiChevronDown, HiCheck } from "react-icons/hi2";
import { FiSearch } from "react-icons/fi";
import { IoMdClose } from "react-icons/io";
import { TbArrowsSort } from "react-icons/tb";
import Fuse from "fuse.js";

import MediaContextMenu from "@/components/MediaContextMenu"; 
import useDownloadStore from "@/stores/useDownloadStore";
import usePlayerStore from "@/stores/usePlayerStore";
import usePlaylistStore from "@/stores/usePlaylistStore";
import { offlineDb } from "@/lib/offlineDb"; 
import { useUser } from "@supabase/auth-helpers-react"; 

export interface LibraryItem {
    id: string;
    type: 'playlist' | 'album' | 'artist' | 'generated_playlist';
    title: string;
    author: string;
    created_at: string;
    sort_date?: string;
    imageUrl: string | null;
    artist_id?: string; 
    song_ids?: string[];
}

export type SortOption = 'recents' | 'recently_added' | 'alphabetical' | 'creator';

const SORT_LABELS: Record<SortOption, string> = {
    recents: 'Recents',
    recently_added: 'Recently Added',
    alphabetical: 'Alphabetical',
    creator: 'Creator',
};

interface LibraryContentProps {
    items: LibraryItem[];
    likedCount: number;
}

// --- SUB-COMPONENT: Library Card ---
const LibraryCard = ({ data, onClick }: { data: LibraryItem; onClick: () => void }) => {
    const isMix = data.type === 'generated_playlist';
    const placeholder = data.type === 'album' 
        ? '/images/album-placeholder.png' 
        : data.type === 'artist' 
        ? '/images/artist-placeholder.png' 
        : isMix 
        ? '/images/mix-placeholder.png' 
        : '/images/playlist-placeholder.jpg';

    const fallbackSrc = isMix && (!data.imageUrl || data.imageUrl.includes('playlist-placeholder'))
        ? '/images/mix-placeholder.png'
        : data.imageUrl || placeholder;

    return (
        <MediaContextMenu
            data={{
                id: data.id,
                type: data.type,
                title: data.title,
                artist_id: data.artist_id,
                song_ids: data.song_ids
            }}
        >
            <div 
                onClick={onClick}
                className="
                    group bg-neutral-900/60 hover:bg-neutral-800/60 p-3 sm:p-4 rounded-xl 
                    border border-neutral-800/80 hover:border-neutral-700/80
                    transition-colors duration-200 cursor-pointer flex flex-col h-full
                "
            >
                <div className={`
                    relative aspect-square w-full overflow-hidden shadow-md mb-3 bg-neutral-800
                    ${data.type === 'artist' ? 'rounded-full' : 'rounded-lg'} 
                `}>
                    <Image 
                        unoptimized
                        className={`object-cover ${data.type === 'artist' ? 'rounded-full' : ''}`}
                        src={fallbackSrc} 
                        fill 
                        alt={data.title} 
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        onError={(e) => {
                            e.currentTarget.src = placeholder;
                        }}
                    />
                </div>

                <div className="flex flex-col gap-1 min-w-0 mt-auto w-full">
                    <h4 
                        className={`font-semibold text-white text-sm truncate ${data.type === 'artist' ? 'text-center' : 'text-left'}`} 
                        title={data.title}
                    >
                        {data.title}
                    </h4>
                    
                    <div className={`flex items-center gap-1.5 text-xs text-neutral-400 ${data.type === 'artist' ? 'justify-center' : 'justify-start'}`}>
                        {data.type === 'album' && <RiAlbumLine size={13} className="shrink-0 text-neutral-400" />}
                        {data.type === 'playlist' && <RiPlayListFill size={13} className="shrink-0 text-neutral-400" />}
                        {data.type === 'generated_playlist' && <BsStars size={13} className="shrink-0 text-purple-400" />}
                        {data.type === 'artist' && <BsPersonFill size={13} className="shrink-0 text-neutral-400" />}

                        <span className="truncate" title={data.author}>
                            {data.author}
                        </span>
                    </div>
                </div>
            </div>
        </MediaContextMenu>
    );
};

// --- MAIN COMPONENT ---
const LibraryContent: React.FC<LibraryContentProps> = ({ items, likedCount }) => {
    const router = useRouter();
    const user = useUser();
    const { downloadedIds } = useDownloadStore();
    const activeContext = usePlayerStore((state) => state.activeContext);
    const version = usePlaylistStore((state) => state.version);

    const [liveItems, setLiveItems] = useState<LibraryItem[]>(items);
    const [filter, setFilter] = useState<'all' | 'downloaded' | 'playlist' | 'generated_playlist' | 'album' | 'artist'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('recents');
    const [sortOpen, setSortOpen] = useState(false);
    const sortMenuRef = useRef<HTMLDivElement>(null);

    const [offlineItems, setOfflineItems] = useState<LibraryItem[]>([]);
    const [offlineLikedCount, setOfflineLikedCount] = useState<number | null>(null);

    // Sync live items when props update
    useEffect(() => {
        setLiveItems(items);
    }, [items]);

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

    // Dynamic update when an item is played: instantly update sort_date so it smoothly floats to top
    useEffect(() => {
        if (!activeContext?.id) return;
        const now = new Date().toISOString();
        setLiveItems((prev) => {
            const exists = prev.some((it) => it.id === activeContext.id);
            if (!exists) return prev;
            return prev.map((it) => {
                if (it.id === activeContext.id) {
                    return { ...it, sort_date: now };
                }
                return it;
            });
        });
        setOfflineItems((prev) => {
            const exists = prev.some((it) => it.id === activeContext.id);
            if (!exists) return prev;
            return prev.map((it) => {
                if (it.id === activeContext.id) {
                    return { ...it, sort_date: now };
                }
                return it;
            });
        });
    }, [activeContext?.id]);

    // Merge any offline downloaded items if they aren't already in items
    useEffect(() => {
        const loadOfflineItems = async () => {
            if (!user) {
                setOfflineItems([]);
                return;
            }

            try {
                let userPlaylists = await offlineDb.playlists
                    .where('user_id')
                    .equals(user.id)
                    .toArray();
                if (userPlaylists.length === 0) {
                    userPlaylists = await offlineDb.playlists.toArray();
                }

                // Get offline liked count from offlineDb.liked_songs (relational) or legacy fallback
                let count = 0;
                if (offlineDb.liked_songs) {
                    count = await offlineDb.liked_songs.where('user_id').equals(user.id).count();
                }
                if (count === 0) {
                    const fallbackLiked = (await offlineDb.playlists.get(`liked_${user.id}`)) || (await offlineDb.playlists.get('liked'));
                    count = fallbackLiked?.playlist_songs?.length || 0;
                }
                setOfflineLikedCount(count);

                const offlineAlbums = await offlineDb.albums.toArray();
                const existingIds = new Set(liveItems.map(it => it.id));
                const extraItems: LibraryItem[] = [];

                for (const pl of userPlaylists) {
                    const isLegacyLiked = pl.id === 'liked' || pl.id.startsWith('liked_');
                    if (!isLegacyLiked && !existingIds.has(pl.id)) {
                        const isMix = (pl as any).is_mix || pl.image_url?.includes('mix-placeholder');
                        extraItems.push({
                            id: pl.id,
                            type: isMix ? 'generated_playlist' : 'playlist',
                            title: pl.title,
                            author: isMix ? 'MuseBuzz Mix' : 'Offline Playlist',
                            created_at: new Date(pl.downloaded_at).toISOString(),
                            sort_date: pl.last_accessed_at || new Date(pl.downloaded_at).toISOString(),
                            imageUrl: (pl.image_path && pl.image_url) 
                                ? pl.image_url 
                                : isMix 
                                ? '/images/mix-placeholder.png' 
                                : '/images/playlist-placeholder.jpg',
                        });
                    }
                }

                for (const alb of offlineAlbums) {
                    if (!existingIds.has(alb.id)) {
                        extraItems.push({
                            id: alb.id,
                            type: 'album',
                            title: alb.title,
                            author: alb.artists?.name || 'Offline Album',
                            created_at: new Date(alb.downloaded_at).toISOString(),
                            sort_date: alb.last_accessed_at || new Date(alb.downloaded_at).toISOString(),
                            imageUrl: alb.image_url || '/images/album-placeholder.png',
                            artist_id: alb.artist_id
                        });
                    }
                }

                setOfflineItems(extraItems);
            } catch (err) {
                console.warn('[LibraryContent] Error loading offline items:', err);
            }
        };

        loadOfflineItems();
    }, [liveItems, user, version]);

    // Combined unique items
    const combinedItems = useMemo(() => {
        const seen = new Set<string>();
        const list: LibraryItem[] = [];
        for (const item of [...liveItems, ...offlineItems]) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                list.push(item);
            }
        }
        return list;
    }, [liveItems, offlineItems]);

    const handleItemClick = (item: LibraryItem) => {
        if (item.type === 'playlist') {
            router.push(`/playlist/${item.id}`);
        } else if (item.type === 'generated_playlist') {
            router.push(`/mix/${item.id}`);
        } else if (item.type === 'artist') {
            router.push(`/artist/${item.id}`);
        } else {
            router.push(`/album/${item.id}`); 
        }
    };

    // Category filter
    const categoryFilteredItems = useMemo(() => {
        return combinedItems.filter((item) => {
            const isLikedItem = item.id === 'liked' || item.id.startsWith('liked_');
            if (isLikedItem) return false;
            if (filter === 'all') return true;
            if (filter === 'downloaded') return downloadedIds.has(item.id);
            return item.type === filter;
        });
    }, [combinedItems, filter, downloadedIds]);

    // Sorting
    const sortedItems = useMemo(() => {
        return [...categoryFilteredItems].sort((a, b) => {
            if (sortBy === 'recents') {
                const timeA = new Date(a.sort_date || a.created_at).getTime();
                const timeB = new Date(b.sort_date || b.created_at).getTime();
                return timeB - timeA;
            }
            if (sortBy === 'recently_added') {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                return timeB - timeA;
            }
            if (sortBy === 'alphabetical') {
                return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
            }
            if (sortBy === 'creator') {
                return (a.author || '').localeCompare(b.author || '', undefined, { sensitivity: 'base' });
            }
            return 0;
        });
    }, [categoryFilteredItems, sortBy]);

    // In-view fuzzy search using Fuse.js
    const fuse = useMemo(() => {
        return new Fuse(sortedItems, {
            keys: [
                { name: 'title', weight: 0.8 },
                { name: 'author', weight: 0.2 }
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

    // Liked Songs card visibility
    const isLikedDownloaded = downloadedIds.has('liked');
    const baseShowLiked = filter === 'all' || filter === 'playlist' || (filter === 'downloaded' && isLikedDownloaded);
    const matchesLikedQuery = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return 'liked songs'.includes(q) || 'liked'.includes(q) || 'songs'.includes(q);
    }, [searchQuery]);
    const showLikedCard = baseShowLiked && matchesLikedQuery;

    return ( 
        <div className="flex flex-col gap-y-6 mt-4">
            
            {/* Filter Pills + In-View Fuzzy Search & Sort Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {(['all', 'downloaded', 'playlist', 'generated_playlist', 'album', 'artist'] as const).map((tab) => {
                        const isActive = filter === tab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setFilter(tab)}
                                className={`
                                    px-4 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5
                                    ${isActive 
                                        ? 'bg-white text-black shadow' 
                                        : 'bg-neutral-800/80 text-neutral-300 hover:text-white hover:bg-neutral-700/80 border border-neutral-700/60'
                                    }
                                `}
                            >
                                {tab === 'downloaded' && <HiArrowDownTray size={13} className="shrink-0" />}
                                {tab === 'all' 
                                    ? 'All' 
                                    : tab === 'downloaded' 
                                    ? `Downloaded ${downloadedIds.size > 0 ? `(${downloadedIds.size})` : ''}` 
                                    : tab === 'playlist' 
                                    ? 'Playlists' 
                                    : tab === 'generated_playlist'
                                    ? 'Made For You'
                                    : tab === 'album' 
                                    ? 'Albums' 
                                    : 'Artists'}
                            </button>
                        );
                    })}
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
                                    ? 'Search in library...'
                                    : filter === 'downloaded'
                                    ? 'Search downloaded...'
                                    : filter === 'playlist'
                                    ? 'Search playlists...'
                                    : filter === 'generated_playlist'
                                    ? 'Search mixes...'
                                    : filter === 'album'
                                    ? 'Search albums...'
                                    : 'Search artists...'
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
                            title="Sort library"
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

            {/* EMPTY STATE */}
            {displayedItems.length === 0 && !showLikedCard ? (
                searchQuery ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-4">
                            <FiSearch size={26} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No matching items found</h3>
                        <p className="text-sm text-neutral-400 max-w-md mb-6">
                            No items match &quot;{searchQuery}&quot; in {filter === 'all' ? 'your library' : filter === 'downloaded' ? 'downloaded items' : filter === 'generated_playlist' ? 'Made For You' : filter + 's'}.
                        </p>
                        <button
                            onClick={() => setSearchQuery('')}
                            className="px-6 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs transition cursor-pointer"
                        >
                            Clear search
                        </button>
                    </div>
                ) : filter === 'downloaded' ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-4">
                            <HiArrowDownTray size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No downloaded music</h3>
                        <p className="text-sm text-neutral-400 max-w-md mb-6">
                            Download albums, playlists, or generated mixes to listen offline even without an internet connection.
                        </p>
                    </div>
                ) : filter === 'generated_playlist' ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-purple-400 mb-4">
                            <BsStars size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No saved mixes yet</h3>
                        <p className="text-sm text-neutral-400 max-w-md mb-6">
                            Explore your &quot;Made For You&quot; mixes on the home page and save your favorites to your library.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                        <h3 className="text-xl font-bold text-white mb-2">Your library is empty</h3>
                        <p className="text-sm text-neutral-400 max-w-md mb-6">
                            Explore music and save playlists, albums, artists, and mixes to your library.
                        </p>
                    </div>
                )
            ) : (
                /* CONTAINER-SPACE AWARE FLUID GRID WITH SMOOTH REORDER ANIMATION */
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-4 sm:gap-5">
                    {/* Liked Songs Card */}
                    {showLikedCard && (
                        <MediaContextMenu
                            data={{
                                id: 'liked',
                                type: 'liked',
                                title: 'Liked Songs',
                            }}
                        >
                            <div
                                onClick={() => router.push('/liked')}
                                className="
                                    group bg-neutral-900/60 hover:bg-neutral-800/60 p-3 sm:p-4 rounded-xl 
                                    border border-neutral-800/80 hover:border-neutral-700/80
                                    transition-colors duration-200 cursor-pointer flex flex-col h-full
                                "
                            >
                                <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-md mb-3 bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-500 flex items-center justify-center">
                                    <AiFillHeart size={44} className="text-white drop-shadow-md" />
                                </div>
                                <div className="flex flex-col gap-1 min-w-0 mt-auto w-full">
                                    <h4 className="font-semibold text-white text-sm truncate" title="Liked Songs">
                                        Liked Songs
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                                        <RiPlayListFill size={13} className="shrink-0 text-purple-400" />
                                        <span className="truncate">
                                            {likedCount || offlineLikedCount || 0} {(likedCount || offlineLikedCount || 0) === 1 ? 'song' : 'songs'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </MediaContextMenu>
                    )}

                    {/* Filtered & Sorted Items */}
                    {displayedItems.map((item) => (
                        <motion.div
                            key={`${item.type}-${item.id}`}
                            layout="position"
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className="h-full"
                        >
                            <LibraryCard 
                                data={item}
                                onClick={() => handleItemClick(item)} 
                            />
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};
 
export default LibraryContent;
