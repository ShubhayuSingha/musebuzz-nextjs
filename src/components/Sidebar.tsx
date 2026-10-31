'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image'; 
import { useRouter } from 'next/navigation';
import { TbPlaylist } from 'react-icons/tb';
import { AiOutlinePlus, AiFillHeart } from 'react-icons/ai'; 
import { FiMenu, FiDownload } from 'react-icons/fi';
import { BsCheckCircleFill } from 'react-icons/bs';

import { motion, AnimatePresence } from 'framer-motion';

import { useUser, useSupabaseClient } from "@supabase/auth-helpers-react";
import useAuthModalStore from "@/stores/useAuthModalStore";
import { toast } from 'react-hot-toast';

import LikeDataLoader from "@/components/LikeDataLoader";
import usePlaylistStore from '@/stores/usePlaylistStore';
import usePlaybackSync from "@/hooks/usePlaybackSync"; 
import MediaContextMenu from "@/components/MediaContextMenu";
import useOfflineModeStore from "@/stores/useOfflineModeStore";
import useDownloadStore from '@/stores/useDownloadStore';
import usePlayerStore from "@/stores/usePlayerStore";
import { offlineDb } from "@/lib/offlineDb";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen?: boolean;
  closeMobile?: () => void;
}

interface SidebarItem {
  id: string;
  type: 'playlist' | 'album' | 'artist' | 'generated_playlist';
  title: string;
  subtitle: string;
  imageUrl: string | null;
  path: string;
  sortDate: string;
  artist_id?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, isMobileOpen, closeMobile }) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const authModal = useAuthModalStore();
  const user = useUser();
  const userId = user?.id;

  usePlaybackSync();
  const { refreshPlaylists, version } = usePlaylistStore();
  const [libraryItems, setLibraryItems] = useState<SidebarItem[]>([]);
  
  const { isOnline, isOfflineMode } = useOfflineModeStore();
  const isDownloaded = useDownloadStore((state) => state.isDownloaded);
  const downloadedCount = useDownloadStore((state) => state.downloadedIds.size);

  const isLikedDownloaded = isDownloaded('liked');

  const loadOfflineDownloads = async () => {
    if (!user?.id) return [];
    const currentUserId = user.id;
    try {
      // 1. Only load playlists belonging strictly to THIS user
      const offlinePlaylists = await offlineDb.playlists
        .where('user_id')
        .equals(currentUserId)
        .toArray();

      // 2. Only load albums saved by THIS user in saved_albums
      let offlineAlbums: any[] = [];
      if (offlineDb.saved_albums) {
        const userSaved = await offlineDb.saved_albums
          .where('user_id')
          .equals(currentUserId)
          .toArray();
        let savedAlbumIds = userSaved.map(s => s.album_id);

        // Auto-heal: If this user downloaded albums in the previous version before saved_albums existed,
        // automatically link them to this user's account so existing downloads are never lost!
        if (savedAlbumIds.length === 0) {
          const totalSavedRecords = await offlineDb.saved_albums.count();
          if (totalSavedRecords === 0) {
            const legacyAlbums = await offlineDb.albums.toArray();
            for (const alb of legacyAlbums) {
              await offlineDb.saved_albums.put({
                user_id: currentUserId,
                album_id: alb.id,
                downloaded_at: alb.downloaded_at || Date.now(),
                last_accessed_at: alb.last_accessed_at || new Date().toISOString()
              });
            }
            savedAlbumIds = legacyAlbums.map(a => a.id);
          }
        }

        if (savedAlbumIds.length > 0) {
          offlineAlbums = await offlineDb.albums.where('id').anyOf(savedAlbumIds).toArray();
        }
      } else {
        offlineAlbums = await offlineDb.albums.toArray();
      }
      const offlinePlItems: SidebarItem[] = offlinePlaylists
        .filter(pl => pl.id !== 'liked' && !pl.id.startsWith('liked_'))
        .map(pl => {
          const isMix = (pl as any).is_mix || pl.image_url?.includes('mix-placeholder');
          let imageUrl = isMix ? '/images/mix-placeholder.png' : '/images/playlist-placeholder.jpg';
          if (pl.image_path && pl.image_url) {
            imageUrl = pl.image_url;
          }
        return {
          id: pl.id,
          type: isMix ? 'generated_playlist' as const : 'playlist' as const,
          title: pl.title,
          subtitle: isMix ? 'Generated Mix' : 'Downloaded Playlist',
          imageUrl: imageUrl,
          path: isMix ? `/mix/${pl.id}` : `/playlist/${pl.id}`,
          sortDate: pl.last_accessed_at || new Date(pl.downloaded_at).toISOString()
        };
      });
      const offlineAlbItems: SidebarItem[] = offlineAlbums.map(alb => ({
        id: alb.id,
        type: 'album',
        title: alb.title,
        subtitle: alb.artists?.name ? `Album • ${alb.artists.name}` : 'Downloaded Album',
        imageUrl: alb.image_url || '/images/album-placeholder.png',
        path: `/album/${alb.id}`,
        sortDate: alb.last_accessed_at || new Date(alb.downloaded_at).toISOString(),
        artist_id: alb.artist_id
      }));
      return [...offlinePlItems, ...offlineAlbItems].sort(
        (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
      );
    } catch {
      return [];
    }
  };

  // --- FETCH LOGIC ---
  const fetchLibrary = async () => {
    const isOffline = !isOnline || isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine);

    if (!user?.id) {
      setLibraryItems([]);
      return;
    }

    if (isOffline) {
      // Preserve existing loaded items if already present to avoid abrupt layout shifts
      if (libraryItems.length === 0) {
        const offlineData = await loadOfflineDownloads();
        setLibraryItems(offlineData.slice(0, 10));
      }
      return;
    }

    try {
      // 1. Fetch Playlists
      const { data: playlists, error: plError } = await supabase
        .from('playlists')
        .select('id, title, image_path, user_id, last_accessed_at, created_at')
        .eq('user_id', user.id)
        .eq('type', 'personal');

      if (plError) throw plError;

      // 2. Fetch Saved Albums
      const { data: savedAlbums, error: albError } = await supabase
        .from('saved_albums')
        .select(`
           created_at,
           last_accessed_at,
           albums (
              id, title, image_path, artists (id, name)
           )
        `)
        .eq('user_id', user.id);

      if (albError) throw albError;

      // 3. Fetch Saved Artists
      const { data: savedArtists, error: artError } = await supabase
        .from('saved_artists')
        .select(`
           created_at,
           last_accessed_at,
           artists (id, name, image_path)
        `)
        .eq('user_id', user.id);

      if (artError) throw artError;

      // 4. Fetch Saved Generated Mixes from user_context_settings
      const { data: savedMixSettings } = await supabase
        .from('user_context_settings')
        .select('context_id, updated_at')
        .eq('user_id', user.id)
        .like('context_id', 'saved_mix:%');

      let formattedMixes: SidebarItem[] = [];
      if (savedMixSettings && savedMixSettings.length > 0) {
        const mixIds = savedMixSettings.map((s: any) => s.context_id.replace('saved_mix:', ''));
        const { data: mixData } = await supabase
          .from('generated_playlists')
          .select('id, title, image_url, created_at')
          .in('id', mixIds);

        formattedMixes = (mixData || []).map((mix: any) => {
          const setting = savedMixSettings.find((s: any) => s.context_id === `saved_mix:${mix.id}`);
          return {
            id: mix.id,
            type: 'generated_playlist' as const,
            title: mix.title,
            subtitle: 'Generated Mix',
            imageUrl: (!mix.image_url || mix.image_url.includes('playlist-placeholder')) 
              ? '/images/mix-placeholder.png' 
              : mix.image_url,
            path: `/mix/${mix.id}`,
            sortDate: setting?.updated_at || mix.created_at
          } as SidebarItem;
        });
      }

      // 4. Normalize Playlists
      const formattedPlaylists: SidebarItem[] = (playlists || []).map((pl: any) => {
        let imageUrl = '/images/playlist-placeholder.jpg';
        if (pl.image_path) {
            const { data: imgData } = supabase.storage.from('playlist_images').getPublicUrl(pl.image_path);
            imageUrl = imgData?.publicUrl || imageUrl;
        }
        const userName = user.user_metadata?.full_name || 'User';

        return {
            id: pl.id,
            type: 'playlist',
            title: pl.title,
            subtitle: `Playlist • ${userName}`,
            imageUrl: imageUrl,
            path: `/playlist/${pl.id}`,
            sortDate: pl.last_accessed_at || pl.created_at
        };
      });

      // 5. Normalize Albums
      const formattedAlbums = (savedAlbums || []).map((item: any) => {
        const album = item.albums;
        if (!album) return null;

        let imageUrl = '/images/album-placeholder.png';
        if (album.image_path) {
            const { data } = supabase.storage.from('images').getPublicUrl(album.image_path);
            imageUrl = data.publicUrl;
        }

        return {
            id: album.id,
            type: 'album' as const,
            title: album.title,
            subtitle: `Album • ${album.artists?.name || 'Various Artists'}`,
            imageUrl: imageUrl,
            path: `/album/${album.id}`,
            sortDate: item.last_accessed_at || item.created_at,
            artist_id: album.artists?.id
        } as SidebarItem;

      }).filter((item) => item !== null) as SidebarItem[];

      // 6. Normalize Artists
      const formattedArtists = (savedArtists || []).map((item: any) => {
        const artist = item.artists;
        if (!artist) return null;

        let imageUrl = '/images/artist-placeholder.png';
        if (artist.image_path) {
            const { data } = supabase.storage.from('artist_images').getPublicUrl(artist.image_path);
            imageUrl = data.publicUrl;
        }

        return {
            id: artist.id,
            type: 'artist' as const, 
            title: artist.name,
            subtitle: 'Artist',
            imageUrl: imageUrl,
            path: `/artist/${artist.id}`,
            sortDate: item.last_accessed_at || item.created_at,
        } as SidebarItem;

      }).filter((item) => item !== null) as SidebarItem[];

      // 7. Combine & Sort
      const combined = [...formattedPlaylists, ...formattedAlbums, ...formattedArtists, ...formattedMixes]
          .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
          .slice(0, 50); 

      setLibraryItems(combined);
    } catch {
      if (user?.id && libraryItems.length === 0) {
        const offlineData = await loadOfflineDownloads();
        setLibraryItems(offlineData.slice(0, 10));
      }
    }
  };

  const activeContext = usePlayerStore((state) => state.activeContext);

  useEffect(() => {
    fetchLibrary();
  }, [userId, supabase, version, isOnline, isOfflineMode, activeContext?.id, downloadedCount]); 

  useEffect(() => {
    const handleNetworkChange = () => {
      fetchLibrary();
    };
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    return () => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, []);

  // --- CREATE PLAYLIST LOGIC ---
  const handleCreatePlaylist = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isOnline || isOfflineMode) {
      toast.error('Creating playlists is disabled offline');
      return;
    }
    if (!user) return authModal.onOpen('sign_in');

    const { count } = await supabase.from('playlists').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const nextNumber = (count || 0) + 1;
    const defaultTitle = `My Playlist #${nextNumber}`;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('playlists')
      .insert({
        user_id: user.id,
        title: defaultTitle,
        type: 'personal',
        description: 'New playlist',
        image_path: null,
        last_accessed_at: now,
        created_at: now 
      })
      .select().single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Playlist Created!');
      refreshPlaylists(); 
      router.refresh(); 
      router.push(`/playlist/${data.id}`);
    }
  };

  const handleLikedClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!user) {
      e.preventDefault(); 
      authModal.onOpen('sign_in'); 
    }
  };

  // HELPER: Common classes for the fixed-width icon container
  const iconBoxClass = "min-w-[80px] h-full flex items-center justify-center flex-shrink-0";
  
  // HELPER: Text container that fades out smoothly in collapsed mode
  const textContainerClass = `
      flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300
      ${isCollapsed ? 'md:opacity-0 md:w-0 md:-translate-x-[10px]' : 'md:opacity-100 md:w-auto md:translate-x-0'}
      opacity-100 w-auto translate-x-0
  `;

  return (
    <aside 
      className={`
        bg-gradient-to-b from-purple-950 to-black text-white py-4 
        flex flex-col flex-shrink-0
        transition-all duration-300 ease-in-out h-full max-h-screen z-40
        w-72 ${isCollapsed ? 'md:w-[80px]' : 'md:w-72'} 
      `}
    >
      <LikeDataLoader />

      {/* SECTION 1: HEADER (Toggle Button & Logo) */}
      <div className="flex items-center h-10 mb-6 w-full">
        {/* Toggle Button Wrapper - HIDDEN ON MOBILE */}
        <div className={`${iconBoxClass} hidden md:flex`}>
            <button 
                onClick={onToggle} 
                className="rounded-full hover:bg-white/10 transition p-2"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"} 
            >
                <FiMenu size={26} />
            </button>
        </div>
        {/* Title & Brand Logo */}
        <div className={`${textContainerClass} md:ml-0 ml-4`}>
          <div className="flex items-center gap-2.5">
            <Image 
              src="/icon.svg" 
              alt="MuseBuzz" 
              width={28} 
              height={28} 
              className="w-7 h-7 object-contain rounded-md drop-shadow shrink-0"
              priority
            />
            <div className="font-bold text-2xl tracking-tight">MuseBuzz</div>
          </div>
        </div>
      </div>

      {/* SECTION 2: PRIMARY NAVIGATION (Your Library, Downloads, Create Playlist) */}
      <nav className="flex-shrink-0 w-full">
        <ul className="flex flex-col w-full">
          {/* Your Library Link */}
          <li className="mb-2 w-full">
            <Link 
                href="/library" 
                onClick={(e) => {
                  if (!user) {
                    e.preventDefault();
                    authModal.onOpen('sign_in');
                    return;
                  }
                  if (closeMobile) closeMobile();
                }}
                className="h-10 flex items-center hover:text-white text-zinc-400 transition-colors duration-200 group"
                title="Your Library" 
            >
              <div className={iconBoxClass}>
                  <TbPlaylist size={26} />
              </div>
              <span className={`${textContainerClass} text-lg font-medium group-hover:text-white`}>Your Library</span>
            </Link>
          </li>

          {/* Downloads Link (Dedicated Offline Downloads View) */}
          <li className="mb-2 w-full">
            <Link 
                href="/downloads" 
                onClick={(e) => {
                  if (!user) {
                    e.preventDefault();
                    authModal.onOpen('sign_in');
                    return;
                  }
                  if (closeMobile) closeMobile();
                }}
                className="h-10 flex items-center hover:text-white text-zinc-400 transition-colors duration-200 group"
                title="Downloads" 
            >
              <div className={iconBoxClass}>
                  <FiDownload size={22} />
              </div>
              <span className={`${textContainerClass} text-lg font-medium group-hover:text-white`}>Downloads</span>
            </Link>
          </li>

          {/* Create Playlist Button */}
          <li className="mb-2 w-full">
            <div 
                onClick={handleCreatePlaylist} 
                className="h-10 flex items-center hover:text-white text-zinc-400 transition-colors duration-200 cursor-pointer group"
                title="Create Playlist" 
            >
              <div className={iconBoxClass}>
                  <div className="bg-zinc-400 group-hover:bg-white text-black p-1 rounded-[4px] transition">
                     <AiOutlinePlus size={18} /> 
                  </div>
              </div>
              <span className={`${textContainerClass} text-lg font-medium group-hover:text-white`}>Create Playlist</span>
            </div>
          </li>
        </ul>
      </nav>

      {/* DIVIDER */}
      <div className={`border-t border-white/10 my-2 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'mx-4' : 'mx-6'}`} />

      {/* SECTION 3: SCROLLABLE MEDIA LIST (Always starts with Liked Songs) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden w-full pb-6 md:pb-4">
        
        {/* Pinned Top Item: Liked Songs Card */}
        <MediaContextMenu 
            data={{ 
                id: 'liked', 
                type: 'liked', 
                title: 'Liked Songs' 
            }}
        >
            <div className="w-full">
              <Link 
                  href="/liked" 
                  onClick={(e) => {
                      handleLikedClick(e);
                      if (closeMobile) closeMobile();
                  }} 
                  className="group flex items-center h-14 hover:bg-white/5 transition cursor-pointer w-full"
                  title="Liked Songs&#10;Your Favourites"
              >
                {/* 48x48 Gradient Cover with White Heart matching reference */}
                <div className={iconBoxClass}>
                  <div className="relative h-12 w-12 overflow-hidden rounded-md shadow-sm bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <AiFillHeart size={24} className="text-white drop-shadow-sm" />
                  </div>
                </div>

                {/* Text Content */}
                <div className={textContainerClass}>
                  <div className="flex items-center gap-1.5 min-w-0 pr-4">
                    <p className="truncate text-white font-medium text-sm">
                      Liked Songs
                    </p>
                    {isLikedDownloaded && (
                      <span className="inline-flex items-center text-emerald-400 flex-shrink-0" title="Downloaded">
                        <BsCheckCircleFill size={13} />
                      </span>
                    )}
                  </div>
                  <p className="truncate text-zinc-400 text-xs pr-4">
                    Your Favourites
                  </p>
                </div>
              </Link>
            </div>
        </MediaContextMenu>

        {/* User Playlists, Albums, Artists */}
        <AnimatePresence initial={false} mode='popLayout'>
          {libraryItems.map((item) => {
            const itemIsDownloaded = isDownloaded(item.id);

            return (
              <MediaContextMenu 
                 key={`${item.type}-${item.id}`} 
                 data={{ id: item.id, type: item.type, title: item.title, artist_id: item.artist_id }}
              >
                  <motion.div
                     layout
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -10 }}
                     transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                       <Link 
                         href={item.path}
                         onClick={() => {
                           if (closeMobile) closeMobile();
                           const isOffline = !isOnline || isOfflineMode || (typeof navigator !== 'undefined' && !navigator.onLine);
                           if (isOffline) {
                             const now = new Date().toISOString();
                             if (item.type === 'playlist' || item.type === 'generated_playlist') {
                               offlineDb.playlists.update(item.id, { last_accessed_at: now })
                                 .then(() => refreshPlaylists())
                                 .catch(() => {});
                             } else if (item.type === 'album') {
                               offlineDb.albums.update(item.id, { last_accessed_at: now })
                                 .then(() => refreshPlaylists())
                                 .catch(() => {});
                             }
                           }
                         }}
                         className="group flex items-center h-14 hover:bg-white/5 transition cursor-pointer w-full"
                         title={`${item.title}\n${item.subtitle}`}
                       >
                           {/* Fixed Width Icon Container */}
                           <div className={iconBoxClass}>
                              <div className="relative h-12 w-12 overflow-hidden rounded-md shadow-sm">
                                  <Image 
                                      unoptimized
                                      fill
                                      sizes="48px"
                                      src={item.imageUrl || (item.type === 'album' ? '/images/album-placeholder.png' : item.type === 'artist' ? '/images/artist-placeholder.png' : item.type === 'generated_playlist' ? '/images/mix-placeholder.png' : '/images/playlist-placeholder.jpg')}
                                      alt={item.title}
                                      className={`object-cover ${item.type === 'artist' ? 'rounded-full' : 'rounded-md'}`}
                                      onError={(e) => {
                                          e.currentTarget.src = item.type === 'album' ? '/images/album-placeholder.png' : item.type === 'artist' ? '/images/artist-placeholder.png' : item.type === 'generated_playlist' ? '/images/mix-placeholder.png' : '/images/playlist-placeholder.jpg';
                                      }}
                                  />
                              </div>
                           </div>

                           {/* Text Content */}
                           <div className={textContainerClass}>
                              <div className="flex items-center gap-1.5 min-w-0 pr-4">
                                <p className="truncate text-white font-medium text-sm">
                                    {item.title}
                                </p>
                                {itemIsDownloaded && (
                                  <span className="inline-flex items-center text-emerald-400 flex-shrink-0" title="Downloaded">
                                    <BsCheckCircleFill size={13} />
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-zinc-400 text-xs pr-4">
                                  {item.subtitle}
                              </p>
                           </div>
                       </Link>
                  </motion.div>
              </MediaContextMenu>
            );
          })}
        </AnimatePresence>
      </div>

    </aside>
  );
};

export default Sidebar;
