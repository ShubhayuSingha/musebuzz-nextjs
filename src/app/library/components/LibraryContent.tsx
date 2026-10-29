"use client";

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AiFillHeart } from "react-icons/ai";
import { RiAlbumLine, RiPlayListFill } from "react-icons/ri"; 
import { BsPersonFill } from "react-icons/bs"; // 🟢 Added Icon for Artists
import { HiArrowDownTray } from "react-icons/hi2";
import MediaContextMenu from "@/components/MediaContextMenu"; 
import { motion, AnimatePresence } from "framer-motion"; 
import useDownloadStore from "@/stores/useDownloadStore";
import { offlineDb } from "@/lib/offlineDb"; 
import { useUser } from "@supabase/auth-helpers-react"; 

export interface LibraryItem {
    id: string;
    // 🟢 UPDATED: Added 'artist' type
    type: 'playlist' | 'album' | 'artist';
    title: string;
    author: string;
    created_at: string;
    imageUrl: string | null;
    artist_id?: string; 
}

interface LibraryContentProps {
    items: LibraryItem[];
    likedCount: number;
}

// --- SUB-COMPONENT: Library Card ---
const LibraryCard = ({ data, onClick }: { data: LibraryItem; onClick: () => void }) => (
    <MediaContextMenu
        data={{
            id: data.id,
            type: data.type,
            title: data.title,
            artist_id: data.artist_id 
        }}
    >
        <div 
            onClick={onClick}
            className="
                relative group flex flex-col items-center justify-center 
                rounded-md overflow-hidden gap-x-4 bg-neutral-400/5 
                cursor-pointer 
                hover:bg-neutral-400/10 
                hover:-translate-y-2
                transition-all duration-300 ease-in-out
                w-full h-full
                p-3
            "
        >
            <div className={`
                relative aspect-square w-full overflow-hidden bg-neutral-800 shadow-md mb-4
                ${data.type === 'artist' ? 'rounded-full' : 'rounded-md'} 
            `}>
                <Image 
                    unoptimized
                    className="object-cover"
                    src={data.imageUrl || (data.type === 'album' ? '/images/album-placeholder.png' : data.type === 'artist' ? '/images/artist-placeholder.png' : '/images/playlist-placeholder.jpg')} 
                    fill 
                    alt={data.title} 
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    onError={(e) => {
                        e.currentTarget.src = data.type === 'album' 
                            ? '/images/album-placeholder.png' 
                            : data.type === 'artist' 
                            ? '/images/artist-placeholder.png' 
                            : '/images/playlist-placeholder.jpg';
                    }}
                />
            </div>

            <div className="flex flex-col items-start w-full gap-y-1">
                {/* Center text for artists, align left for albums/playlists */}
                <p className={`font-semibold truncate w-full text-white text-[15px] ${data.type === 'artist' ? 'text-center' : 'text-left'}`} title={data.title}>
                    {data.title}
                </p>
                
                <div className={`flex items-center gap-x-2 w-full text-neutral-400 text-sm ${data.type === 'artist' ? 'justify-center' : 'justify-start'}`}>
                    <div className="flex-shrink-0">
                        {data.type === 'album' && <RiAlbumLine size={14} />}
                        {data.type === 'playlist' && <RiPlayListFill size={14} />}
                        {/* 🟢 Added Artist Icon */}
                        {data.type === 'artist' && <BsPersonFill size={14} />}
                    </div>

                    <p className="truncate font-medium text-xs text-neutral-400" title={data.author}>
                        {data.author}
                    </p>
                </div>
            </div>
        </div>
    </MediaContextMenu>
);

// --- MAIN COMPONENT ---
const LibraryContent: React.FC<LibraryContentProps> = ({ items, likedCount }) => {
    const router = useRouter();
    const user = useUser();
    const { downloadedIds } = useDownloadStore();
    const [filter, setFilter] = useState<'all' | 'playlist' | 'album' | 'artist' | 'downloaded'>('all');
    const [offlineItems, setOfflineItems] = useState<LibraryItem[]>([]);
    const [offlineLikedCount, setOfflineLikedCount] = useState<number | null>(null);
    
    const [gridCols, setGridCols] = useState(4);
    const containerRef = useRef<HTMLDivElement>(null);

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
                const existingIds = new Set(items.map(it => it.id));
                const extraItems: LibraryItem[] = [];

                for (const pl of userPlaylists) {
                    const isLegacyLiked = pl.id === 'liked' || pl.id.startsWith('liked_');
                    if (!isLegacyLiked && !existingIds.has(pl.id)) {
                        extraItems.push({
                            id: pl.id,
                            type: 'playlist',
                            title: pl.title,
                            author: 'Offline Playlist',
                            created_at: new Date(pl.downloaded_at).toISOString(),
                            imageUrl: (pl.image_path && pl.image_url) ? pl.image_url : '/images/playlist-placeholder.jpg',
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
    }, [items, user]);

    const combinedItems = [...items, ...offlineItems];

    const handleItemClick = (item: LibraryItem) => {
        if (item.type === 'playlist') {
            router.push(`/playlist/${item.id}`);
        } else if (item.type === 'artist') {
            // 🟢 Handle Artist Navigation
            router.push(`/artist/${item.id}`);
        } else {
            router.push(`/album/${item.id}`); 
        }
    };

    useLayoutEffect(() => {
        const calculateColumns = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                const minCardWidth = 150; 
                const gap = 16;
                
                if (width <= 0) return;

                const cols = Math.floor((width + gap) / (minCardWidth + gap));
                setGridCols(Math.min(Math.max(2, cols), 10));
            }
        };

        calculateColumns();
        let timeoutId: NodeJS.Timeout;

        const observer = new ResizeObserver(() => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                calculateColumns();
            }, 100);
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            observer.disconnect();
            clearTimeout(timeoutId);
        };
    }, []);

    const isLikedDownloaded = downloadedIds.has('liked');

    const filteredItems = combinedItems.filter((item) => {
        const isLikedItem = item.id === 'liked' || item.id.startsWith('liked_');
        if (isLikedItem) return false;
        if (filter === 'all') return true;
        if (filter === 'downloaded') return downloadedIds.has(item.id);
        return item.type === filter;
    });

    const showLikedCard = filter === 'all' || filter === 'playlist' || (filter === 'downloaded' && isLikedDownloaded);

    const getChipClass = (type: string) => {
        const isActive = filter === type;
        return `
            px-3 py-1.5 rounded-full font-medium text-sm cursor-pointer transition flex items-center gap-1.5 whitespace-nowrap
            ${isActive 
                ? 'bg-white text-black hover:scale-105 shadow-md' 
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
            }
        `;
    };

    return ( 
        <div className="flex flex-col gap-y-6 mt-4">
            
            {/* CHIPS */}
            <div className="flex items-center gap-x-3 overflow-x-auto no-scrollbar">
                <div onClick={() => setFilter('all')} className={getChipClass('all')}>
                    All
                </div>
                <div onClick={() => setFilter('downloaded')} className={getChipClass('downloaded')}>
                    <HiArrowDownTray className="w-3.5 h-3.5" />
                    Downloaded {downloadedIds.size > 0 ? `(${downloadedIds.size})` : ''}
                </div>
                <div onClick={() => setFilter('playlist')} className={getChipClass('playlist')}>
                    Playlists
                </div>
                <div onClick={() => setFilter('album')} className={getChipClass('album')}>
                    Albums
                </div>
                {/* 🟢 Added Artist Chip */}
                <div onClick={() => setFilter('artist')} className={getChipClass('artist')}>
                    Artists
                </div>
            </div>

            {/* EMPTY STATE FOR DOWNLOADED FILTER */}
            {filter === 'downloaded' && filteredItems.length === 0 && !isLikedDownloaded && (
                <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-400 px-4">
                    <div className="w-16 h-16 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center mb-4">
                        <HiArrowDownTray className="w-8 h-8 text-neutral-500" />
                    </div>
                    <p className="text-white font-semibold text-lg mb-1">No downloaded music</p>
                    <p className="text-sm text-neutral-400 max-w-sm">
                        Download albums or playlists to listen offline even without an internet connection.
                    </p>
                </div>
            )}

            {/* GRID WITH MOTION */}
            <motion.div 
                ref={containerRef}
                className="grid gap-4 mt-2"
                style={{
                    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`
                }}
                layout 
            >
                <AnimatePresence mode="popLayout">
                    {/* Liked Songs Card */}
                    {showLikedCard && (
                        <motion.div 
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => router.push('/liked')}
                            className="
                                relative group flex flex-col items-center justify-center rounded-md overflow-hidden gap-x-4 
                                bg-gradient-to-br from-purple-700 to-blue-900
                                cursor-pointer 
                                hover:bg-neutral-400/10 
                                hover:-translate-y-2 
                                transition-all duration-300 ease-in-out
                                w-full h-full p-3
                            "
                        >
                            <div className="relative aspect-square w-full flex items-center justify-center mb-4">
                                <AiFillHeart size={48} className="text-white drop-shadow-lg" />
                            </div>
                            <div className="flex flex-col items-start w-full gap-y-1">
                                <p className="font-semibold truncate w-full text-white text-[15px]">Liked Songs</p>
                                <div className="flex items-center gap-x-2 w-full text-neutral-300 text-sm">
                                    <div className="flex-shrink-0">
                                        <RiPlayListFill size={14} />
                                    </div>
                                    <p className="truncate font-medium text-xs">
                                        {likedCount || offlineLikedCount || 0} songs
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Filtered Items */}
                    {filteredItems.map((item) => (
                        <motion.div
                            layout
                            key={`${item.type}-${item.id}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            <LibraryCard 
                                data={item}
                                onClick={() => handleItemClick(item)} 
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>
        </div>
     );
}
 
export default LibraryContent;