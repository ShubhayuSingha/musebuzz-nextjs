'use client';

import { useRouter } from "next/navigation";
import Image from "next/image";
import { BsPlayFill, BsPauseFill, BsClock } from "react-icons/bs";
import { useEffect, useState, useRef, useLayoutEffect } from "react"; 
import { motion, AnimatePresence, Variants } from "framer-motion"; 

import usePlayerStore from "@/stores/usePlayerStore";
import usePlaylistStore from "@/stores/usePlaylistStore"; 
import { useUser } from "@supabase/auth-helpers-react";
import MediaContextMenu from "@/components/MediaContextMenu"; 
import SongContextMenu from "@/components/SongContextMenu"; 
import LikeButton from "@/components/LikeButton";
import AddToQueueButton from "@/components/AddToQueueButton"; 
import PlayingAnimation from "@/components/PlayingAnimation";
import useLibrary from "@/hooks/useLibrary"; 

// ANIMATION VARIANTS
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, type: 'spring', stiffness: 220, damping: 22 },
  }),
};

interface ArtistContentProps {
  artistName: string;
  artistId: string;
  songs: any[];
  albums: any[];
}

const formatTime = (seconds: number) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${minutes}:${remaining < 10 ? '0' : ''}${remaining}`;
};

const ArtistContent: React.FC<ArtistContentProps> = ({
    artistName,
    artistId,
    songs,
    albums
}) => {
  const router = useRouter();
  const player = usePlayerStore();
  const { refreshPlaylists } = usePlaylistStore(); 
  const user = useUser();
  const library = useLibrary(); 

  const [isFollowing, setIsFollowing] = useState(false); 
  
  // GRID RESIZE STATE
  const [gridCols, setGridCols] = useState(5);
  const containerRef = useRef<HTMLDivElement>(null);

  // CHECK FOLLOW STATUS
  useEffect(() => {
      const check = async () => {
          const status = await library.checkIsArtistSaved(artistId);
          setIsFollowing(status);
      }
      check();
  }, [artistId, library]);

  // RESIZE LOGIC
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

  // HANDLE TOGGLE FOLLOW
  const toggleFollow = async () => {
      if (isFollowing) {
          await library.unfollowArtist(artistId);
          setIsFollowing(false);
      } else {
          await library.followArtist(artistId);
          setIsFollowing(true);
      }
      refreshPlaylists(); 
      router.refresh();
  }

  const getContext = () => ({
      type: 'artist' as const, 
      title: artistName, 
      id: artistId 
  });

  // PLAY ALL SONGS 
  const onPlayArtist = () => {
     if (!songs.length) return;
     
     library.updateArtistAccess(artistId);
     refreshPlaylists();

     const context = getContext();
     const isCurrentContext = 
        player.activeContext?.id === context.id && 
        player.activeContext?.type === context.type;

     if (isCurrentContext && player.isPlaying && !player.isPlayingPriority) {
         player.setIsPlaying(false);
         return;
     }

     if (isCurrentContext && !player.isPlaying && !player.isPlayingPriority) {
         player.setIsPlaying(true);
         return;
     }

     player.setIds(songs.map(s => s.id), context, user?.id);
     player.setId(songs[0].id, context);
  };

  // PLAY SINGLE SONG 
  const onPlaySong = (id: string) => {
     library.updateArtistAccess(artistId);
     refreshPlaylists();

     const context = getContext();
     const isCurrentContext = 
        player.activeContext?.id === context.id && 
        player.activeContext?.type === context.type;

     if (isCurrentContext) {
        if (player.activeId === id && !player.isPlayingPriority) {
            player.setIsPlaying(!player.isPlaying);
            return;
        }
        player.playFromContext(id, context);
     } else {
        player.setIds(songs.map(s => s.id), context, user?.id);
        player.setId(id, context);
     }
  };

  return (
    <div className="flex flex-col gap-y-8 p-6">
        
        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-x-4">
             <button 
                onClick={onPlayArtist}
                className="
                    transition rounded-full flex items-center bg-green-500 p-4 
                    drop-shadow-md translate hover:scale-105
                "
             >
                {player.activeContext?.id === artistId && player.activeContext?.type === 'artist' && player.isPlaying ? (
                     <BsPauseFill className="text-black" size={25} />
                ) : (
                     <BsPlayFill className="text-black" size={25} />
                )}
             </button>
             
             <button 
                onClick={toggleFollow}
                className={`
                    px-6 py-2 border rounded-full text-sm font-bold transition hover:scale-105
                    ${isFollowing 
                        ? 'bg-transparent border-white text-white hover:border-white' 
                        : 'bg-transparent border-neutral-400 text-white hover:border-white'
                    }
                `}
             >
                {isFollowing ? 'Unfollow' : 'Follow'}
             </button>
        </div>

        {/* 1. SONGS LIST */}
        <div className="flex flex-col gap-y-2 w-full">
             <h2 className="text-2xl font-bold text-white mb-2">Songs</h2>
             
             {/* STICKY HEADER */}
             <div className="
                grid 
                grid-cols-[40px_50px_4fr_3fr_80px_50px]
                items-center 
                px-3 
                py-2 
                border-b 
                border-neutral-700/50
                text-neutral-400 
                text-sm 
                font-medium
                sticky
                top-0
                bg-neutral-900/95 
                backdrop-blur-sm
                z-10
             ">
                <div className="flex justify-center">#</div>
                <div>{/* Image Col */}</div>
                <div>Title</div>
                <div className="hidden md:block">Album</div>
                <div>{/* Actions */}</div>
                <div className="flex justify-end pr-2">
                    <BsClock size={16} />
                </div>
             </div>

             <div className="flex flex-col">
                <AnimatePresence mode="popLayout">
                    {songs.map((song, index) => {
                        const isActive = 
                            player.activeId === song.id && 
                            player.activeContext?.id === artistId && 
                            player.activeContext?.type === 'artist';
                            
                        const isPlayingState = isActive && player.isPlaying;
                        
                        return (
                        <SongContextMenu 
                            key={song.id} 
                            songId={song.id}
                            albumId={song.album_id} // 🟢 Go to Album
                            isReadOnly={true}       // 🟢 Read Only
                        >
                            <motion.div 
                                layout
                                custom={index}
                                variants={rowVariants}
                                initial="hidden"
                                animate="show"
                                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                                whileTap={{ scale: 0.996 }}
                                onClick={() => onPlaySong(song.id)}
                                className={`
                                    group 
                                    grid 
                                    grid-cols-[40px_50px_4fr_3fr_80px_50px]
                                    items-center 
                                    px-3 
                                    py-2 
                                    rounded-md 
                                    cursor-pointer
                                    transition-colors
                                    ${isActive ? 'bg-neutral-800/50' : 'hover:bg-neutral-800/50'}
                                `}
                            >
                                {/* 1. Icon / Index */}
                                <div className="flex items-center justify-center">
                                    {isActive && isPlayingState ? (
                                        <>
                                            <div className="group-hover:hidden">
                                                <PlayingAnimation />
                                            </div>
                                            <BsPauseFill size={22} className="hidden group-hover:block text-white" />
                                        </>
                                    ) : (
                                        <>
                                            <span className={`group-hover:hidden ${isActive ? 'text-green-500' : 'text-neutral-400'}`}>
                                                {index + 1}
                                            </span>
                                            <BsPlayFill size={22} className="hidden group-hover:block text-white" />
                                        </>
                                    )}
                                </div>

                                {/* 2. Image */}
                                <div className="relative h-10 w-10 overflow-hidden rounded-md">
                                    <Image fill src={song.imageUrl} alt={song.title} className="object-cover" />
                                </div>

                                {/* 3. Title */}
                                <div className="min-w-0 pr-4">
                                    <p className={`truncate font-medium ${isActive ? 'text-green-500' : 'text-white'}`}>
                                        {song.title}
                                    </p>
                                </div>

                                {/* 4. Album Name (Clickable) */}
                                <div className="hidden md:flex items-center overflow-hidden min-w-0">
                                    <p 
                                        onClick={(e) => {
                                            e.stopPropagation(); 
                                            router.push(`/album/${song.album_id}`);
                                        }}
                                        className="truncate text-sm text-neutral-400 hover:text-white hover:underline cursor-pointer transition pr-4"
                                    >
                                        {song.albums?.title || "Unknown Album"}
                                    </p>
                                </div>

                                {/* 5. Actions (Queue + Like) */}
                                <div className="flex justify-center items-center gap-x-3" onClick={(e) => e.stopPropagation()}>
                                    <AddToQueueButton songId={song.id} />
                                    <LikeButton songId={song.id} />
                                </div>

                                {/* 6. Duration */}
                                <div className="text-sm text-neutral-400 text-right pr-2">
                                    {formatTime(song.duration_seconds)}
                                </div>
                            </motion.div>
                        </SongContextMenu>
                        )
                    })}
                </AnimatePresence>
             </div>
        </div>

        {/* 2. DISCOGRAPHY (Dynamic Grid) */}
        <div className="flex flex-col gap-y-4">
            <h2 className="text-2xl font-bold text-white">Discography</h2>
            
            <motion.div 
                ref={containerRef}
                className="grid gap-4 mt-2"
                style={{
                    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`
                }}
                layout
            >
                {albums.map((album) => (
                    <motion.div layout key={album.id}>
                        {/* Albums still use MediaContextMenu (Correct) */}
                        <MediaContextMenu data={{ id: album.id, type: 'album', artist_id: artistId, title: album.title }}>
                            <div 
                            onClick={() => router.push(`/album/${album.id}`)}
                            className="
                                group 
                                relative 
                                flex flex-col 
                                items-center 
                                justify-center 
                                rounded-md 
                                overflow-hidden 
                                gap-x-4 
                                bg-neutral-400/5 
                                cursor-pointer 
                                hover:bg-neutral-400/10 
                                hover:-translate-y-2
                                transition-all duration-300 ease-in-out
                                p-3
                                h-full
                            "
                            >
                                <div className="relative aspect-square w-full rounded-md overflow-hidden mb-4 shadow-lg bg-neutral-800">
                                    <Image 
                                        fill 
                                        src={album.imageUrl} 
                                        alt={album.title} 
                                        className="object-cover" 
                                    />
                                </div>
                                <div className="flex flex-col items-start w-full">
                                    <p className="font-semibold truncate w-full text-white text-[15px]">
                                        {album.title}
                                    </p>
                                    <p className="text-neutral-400 text-sm pb-4 w-full truncate">
                                        {new Date(album.created_at).getFullYear()} • Album
                                    </p>
                                </div>
                            </div>
                        </MediaContextMenu>
                    </motion.div>
                ))}
            </motion.div>
        </div>

    </div>
  );
}

export default ArtistContent;