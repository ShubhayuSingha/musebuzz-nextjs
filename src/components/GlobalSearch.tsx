'use client';

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BiSearch } from "react-icons/bi";
import { IoMdClose } from "react-icons/io"; 
import { useSearch } from "@/hooks/useSearch";
import { useSearchHistory, SearchHistoryItem } from "@/hooks/useSearchHistory";
import Image from "next/image";
import usePlayerStore from "@/stores/usePlayerStore";
import { BsPlayFill, BsTrash, BsPlusLg } from "react-icons/bs";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

import LikeButton from "@/components/LikeButton";
import AddToQueueButton from "@/components/AddToQueueButton";
import SongContextMenu from "@/components/SongContextMenu";
import MediaContextMenu from "@/components/MediaContextMenu";

// The absolute last-resort fallback (a 1x1 purple pixel) if a file is deleted from Supabase
const PLACEHOLDER_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/* ================================================================
   1) SWIPEABLE HISTORY ITEM (Mobile only)
   Swipe Left  => Delete
   Swipe Right => Add to Queue
================================================================ */
const SwipeableHistoryItem = ({ item, onClick, onRemove, onAddToQueue, getImageUrl, bucket, path }: any) => {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-100, -50], [1, 0]);
  const addOpacity = useTransform(x, [50, 100], [0, 1]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.x < -80 && onRemove) {
        onRemove();
    } else if (info.offset.x > 80 && onAddToQueue) {
        onAddToQueue();
    }
  };

  return (
    <div className="relative mb-2 overflow-visible rounded-md bg-black">
        {/* Swipe Left Background (Trash) */}
        <motion.div style={{ opacity: deleteOpacity }} className="absolute right-4 top-0 bottom-0 flex items-center justify-center text-red-500 z-0">
            <BsTrash size={20} />
        </motion.div>
        
        {/* Swipe Right Background (Add to Queue) */}
        {item.item_type === 'song' && (
          <motion.div style={{ opacity: addOpacity }} className="absolute left-4 top-0 bottom-0 flex items-center justify-center text-green-500 z-0">
              <BsPlusLg size={20} />
          </motion.div>
        )}

        {/* Draggable Row Surface */}
        <motion.div
            style={{ x }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            className="relative z-10 bg-black flex items-center justify-between py-2 cursor-pointer group px-1 rounded-md active:bg-neutral-800" 
            onClick={onClick}
        >
            <div className="flex items-center gap-x-3 overflow-hidden flex-1 pointer-events-none">
              <div className={`relative h-12 w-12 min-w-[48px] overflow-hidden shrink-0 ${item.item_type === 'artist' ? 'rounded-full' : ''}`}>
                  <Image fill src={getImageUrl(path, bucket)} alt={item.title} className="object-cover" unoptimized onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }} />
              </div>
              <div className="flex flex-col overflow-hidden">
                  <p className="text-[15px] font-medium text-white truncate">{item.title}</p>
                  <p className="text-xs text-neutral-400 truncate">{item.subtitle}</p>
              </div>
            </div>
        </motion.div>
    </div>
  );
};

/* ================================================================
   2) SWIPEABLE SONG ITEM (Mobile Live Results)
   Swipe Right => Add to Queue
================================================================ */
const SwipeableSongItem = ({ song, onClick, onAddToQueue, getImageUrl, children }: any) => {
  const x = useMotionValue(0);
  const addOpacity = useTransform(x, [50, 100], [0, 1]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.x > 80 && onAddToQueue) {
        onAddToQueue();
    }
  };

  return (
    <div className="relative mb-1 overflow-visible rounded-md bg-black">
        {/* Swipe Right Background (Add to Queue) */}
        <motion.div style={{ opacity: addOpacity }} className="absolute left-4 top-0 bottom-0 flex items-center justify-center text-green-500 z-0">
            <BsPlusLg size={20} />
        </motion.div>

        {/* Draggable Row Surface */}
        <motion.div
            style={{ x }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            className="relative z-10 bg-black flex items-center justify-between p-1 rounded-md cursor-pointer w-full active:bg-neutral-800"
            onClick={onClick}
        >
            <div className="flex items-center gap-x-3 overflow-hidden pointer-events-none">
              <div className="relative h-12 w-12 min-w-[48px] overflow-hidden shrink-0">
                <Image fill src={getImageUrl(song.albums?.image_path || 'sample.jpg')} alt={song.title} className="object-cover" unoptimized onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }} />
              </div>
              <div className="flex flex-col overflow-hidden">
                <p className="text-[15px] font-medium text-white truncate">{song.title}</p>
                <p className="text-xs text-neutral-400 truncate">{song.albums?.artists?.name}</p>
              </div>
            </div>
            {children}
        </motion.div>
    </div>
  );
};


interface GlobalSearchProps {
  isMobileRightAligned?: boolean;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isMobileRightAligned = false }) => {
  const router = useRouter();
  const { searchAll } = useSearch();
  const { history, addToHistory, removeFromHistory, clearAllHistory } = useSearchHistory();
  
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false); // Mobile full-screen toggle
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null); 
  const mobileInputRef = useRef<HTMLInputElement>(null);
  
  const player = usePlayerStore();

  const results = searchAll(query);
  const hasResults = results.songs.length > 0 || results.albums.length > 0 || results.artists.length > 0 || results.playlists.length > 0;

  // Infinite scroll tracker for songs
  const [visibleSongCount, setVisibleSongCount] = useState(10);

  // Reset infinite scroll when typing a new search
  useEffect(() => {
    setVisibleSongCount(10);
  }, [query]);

  // Handle clicking outside to close the search window
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (event.button === 2) return;
      if (event.ctrlKey) return;

      const target = event.target as Element;
      const isInsideSearch = containerRef.current && containerRef.current.contains(target);
      const isInsideRadixContent = target.closest('[data-radix-context-menu-content]');

      if (!isInsideSearch && !isInsideRadixContent) setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Infinite Scroll Listener
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 20) {
      if (visibleSongCount < results.songs.length) {
        setVisibleSongCount(prev => prev + 10);
      }
    }
  };

  // Handles clicking a live search result, saves to DB history, then navigates/plays
  const handleSearchResultClick = (item: any, type: 'song' | 'album' | 'artist' | 'playlist') => {
    let title = item.title || item.name;
    let subtitle = '';
    let image_path = item.image_path || item._unified_image || null; 

    if (type === 'song') subtitle = item.albums?.artists?.name || 'Song';
    else if (type === 'album') subtitle = `Album • ${item.artists?.name || 'Unknown'}`;
    else if (type === 'artist') subtitle = 'Artist';
    else if (type === 'playlist') subtitle = 'Playlist';

    // Push to Database
    addToHistory({ item_id: item.id, item_type: type, title, subtitle, image_path });

    // Execute Action
    if (type === 'song') {
      player.setId(item.id);
      player.setIds([item.id]);
    } else if (type === 'album') {
      router.push(`/album/${item.id}`);
      setIsOpen(false);
    } else if (type === 'artist') {
      router.push(`/artist/${item.id}`);
      setIsOpen(false);
    } else if (type === 'playlist') {
      router.push(`/playlist/${item.id}`); 
      setIsOpen(false);
    }
  };

  // Handles clicking a historical search item
  const handleHistoryClick = (item: SearchHistoryItem) => {
    if (item.item_type === 'song') {
      player.setId(item.item_id);
      player.setIds([item.item_id]);
    } else {
      router.push(`/${item.item_type}/${item.item_id}`);
      setIsOpen(false);
    }
  };

  const clearSearch = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    setQuery("");
    inputRef.current?.focus();
  };

  // Helper to fetch public URL from Supabase
  const getImageUrl = (path: string | null, bucket: string = 'images') => {
    if (!path) return PLACEHOLDER_IMAGE;
    if (path.startsWith('http')) return path; 
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div ref={containerRef} className={`${isMobileRightAligned ? 'w-auto' : 'relative w-full max-w-[400px] z-50'}`}>
      
      {/* 🟢 MOBILE TRIGGER ICON (visible only on phones) */}
      {isMobileRightAligned && (
        <div 
          onClick={() => setIsMobileOpen(true)}
          className="flex md:hidden p-2 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <BiSearch size={24} />
        </div>
      )}

      {/* 🟢 DESKTOP SEARCH BAR */}
      {!isMobileRightAligned && (
      <div 
        onClick={() => inputRef.current?.focus()}
        className="hidden md:flex relative items-center bg-neutral-800 rounded-full px-4 py-3 group focus-within:ring-2 focus-within:ring-white transition cursor-text w-full"
      >
        <BiSearch className="text-neutral-400 group-focus-within:text-white shrink-0" size={24} />
        <input 
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search songs, albums, artists, playlists..."
          className="bg-transparent border-none outline-none text-white ml-2 w-full placeholder:text-neutral-400 text-sm font-medium pr-6" 
        />
        
        {query && (
          <div 
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer p-1"
          >
            <IoMdClose size={20} />
          </div>
        )}
      </div>
      )}

      {/* 🟢 RECENT SEARCHES (Desktop - Shows when input is empty) */}
      {isOpen && !isMobileOpen && query === "" && history.length > 0 && (
        <div className="
            absolute top-[110%] md:left-0 w-[95vw] md:w-full 
            left-1/2 -translate-x-1/2 md:translate-x-0
            bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden 
            animate-fade-in p-2 flex flex-col max-h-[80vh] overflow-y-auto scrollbar-hide
        ">
           <h3 className="text-xs font-bold text-neutral-400 mb-2 mt-2 px-2 uppercase tracking-wider">Recent Searches</h3>
           
           {history.map(item => {
              // Dynamically determine the bucket and the specific fallback logic based on history type
              const bucket = item.item_type === 'artist' ? 'artist_images' : item.item_type === 'playlist' ? 'playlist_images' : 'images';
              const path = item.image_path || (
                  item.item_type === 'playlist' ? 'playlist-placeholder.jpg' : 
                  (item.item_type === 'song' || item.item_type === 'album') ? 'sample.jpg' : 
                  null
              );

              return (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-2 rounded-md hover:bg-neutral-800 cursor-pointer group" 
                  onClick={() => handleHistoryClick(item)}
                >
                   <div className="flex items-center gap-x-3 overflow-hidden">
                      <div className="relative h-10 w-10 min-w-[40px] overflow-hidden rounded-md shrink-0">
                         <Image 
                           fill 
                           src={getImageUrl(path, bucket)} 
                           alt={item.title} 
                           className={`object-cover ${item.item_type === 'artist' ? 'rounded-full' : ''}`} 
                           unoptimized 
                           onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                         />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                         <p className="text-sm font-medium text-white truncate">{item.title}</p>
                         <p className="text-xs text-neutral-400 truncate">{item.subtitle}</p>
                      </div>
                   </div>
                   
                   {/* The 'X' Button for individual history removal */}
                   <div 
                      className="text-neutral-500 hover:text-white p-2 hidden group-hover:block transition" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        removeFromHistory(item.id); 
                      }}
                   >
                      <IoMdClose size={18} />
                   </div>
                </div>
              );
           })}
           
           <button 
             onClick={clearAllHistory} 
             className="mt-4 py-3 text-xs font-bold text-neutral-400 hover:text-white transition w-full text-center border-t border-neutral-800"
           >
              Clear recent searches
           </button>
        </div>
      )}

      {/* 🟢 LIVE SEARCH RESULTS (Desktop - Shows when typing) */}
      {isOpen && !isMobileOpen && query.length > 0 && hasResults && (
        <div 
          onScroll={handleScroll}
          className="
              absolute top-[110%] md:left-0 w-[95vw] md:w-full 
              left-1/2 -translate-x-1/2 md:translate-x-0
              bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden 
              animate-fade-in p-2 flex flex-col gap-y-4 max-h-[80vh] overflow-y-auto scrollbar-hide
          "
        >
          
          {/* 1. TOP ARTIST */}
          {results.artists.length > 0 && (
            <div className="p-2">
               <h3 className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">Top Artist</h3>
               <MediaContextMenu data={{ id: results.artists[0].id, type: 'artist', title: results.artists[0].name }}>
                   <div 
                     onClick={() => handleSearchResultClick(results.artists[0], 'artist')}
                     className="flex items-center gap-x-3 hover:bg-neutral-800 p-2 rounded-md cursor-pointer transition w-full"
                   >
                      <div className="relative h-12 w-12 rounded-full overflow-hidden shrink-0">
                         <Image 
                           fill 
                           src={getImageUrl(results.artists[0].image_path, 'artist_images')} 
                           alt={results.artists[0].name} 
                           className="object-cover" 
                           unoptimized 
                           onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                         />
                      </div>
                      <p className="font-bold text-white">{results.artists[0].name}</p>
                   </div>
               </MediaContextMenu>
            </div>
          )}

          {/* 2. PLAYLISTS */}
          {results.playlists.length > 0 && (
             <div className="p-2">
                <h3 className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">Playlists</h3>
                {results.playlists.map(playlist => (
                   <MediaContextMenu key={playlist.id} data={{ id: playlist.id, type: 'playlist', title: playlist.title }}>
                       <div 
                         onClick={() => handleSearchResultClick(playlist, 'playlist')}
                         className="flex items-center gap-x-3 p-2 rounded-md hover:bg-neutral-800 cursor-pointer w-full"
                       >
                         <div className="relative h-10 w-10 min-w-[40px] overflow-hidden rounded-md shrink-0">
                             <Image 
                               fill 
                               src={getImageUrl(playlist._unified_image || 'playlist-placeholder.jpg', 'playlist_images')} 
                               alt={playlist.title} 
                               className="object-cover" 
                               unoptimized 
                               onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                             />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                             <p className="text-sm font-medium text-white truncate">{playlist.title}</p>
                             <p className="text-xs text-neutral-400 truncate">Playlist</p>
                          </div>
                       </div>
                   </MediaContextMenu>
                ))}
             </div>
          )}

          {/* 3. ALBUMS */}
          {results.albums.length > 0 && (
             <div className="p-2">
                <h3 className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">Albums</h3>
                {results.albums.map(album => (
                   <MediaContextMenu key={album.id} data={{ id: album.id, type: 'album', title: album.title, artist_id: album.artists?.id }}>
                       <div 
                         onClick={() => handleSearchResultClick(album, 'album')}
                         className="flex items-center gap-x-3 p-2 rounded-md hover:bg-neutral-800 cursor-pointer w-full"
                       >
                         <div className="relative h-10 w-10 min-w-[40px] overflow-hidden rounded-md shrink-0">
                             <Image 
                               fill 
                               src={getImageUrl(album.image_path || 'sample.jpg')} 
                               alt={album.title} 
                               className="object-cover" 
                               unoptimized 
                               onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                             />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                             <p className="text-sm font-medium text-white truncate">{album.title}</p>
                             <p className="text-xs text-neutral-400 truncate">Album • {album.artists?.name}</p>
                          </div>
                       </div>
                   </MediaContextMenu>
                ))}
             </div>
          )}

          {/* 4. SONGS (Infinite Scroll at Bottom) */}
          {results.songs.length > 0 && (
            <div className="p-2">
               <h3 className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">Songs</h3>
               <div className="flex flex-col gap-y-1">
                 {results.songs.slice(0, visibleSongCount).map((song) => (
                   <SongContextMenu key={song.id} songId={song.id}>
                       <div 
                         onClick={() => handleSearchResultClick(song, 'song')}
                         className="flex items-center justify-between p-2 rounded-md hover:bg-neutral-800 cursor-pointer group"
                       >
                         <div className="flex items-center gap-x-3 overflow-hidden">
                           <div className="relative h-10 w-10 min-w-[40px] overflow-hidden rounded-md shrink-0">
                             <Image 
                               fill 
                               src={getImageUrl(song.albums?.image_path || 'sample.jpg')} 
                               alt={song.title} 
                               className="object-cover" 
                               unoptimized 
                               onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                             />
                             <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center">
                                <BsPlayFill size={20} className="text-white" />
                             </div>
                           </div>
                           <div className="flex flex-col overflow-hidden">
                             <p className="text-sm font-medium text-white truncate">{song.title}</p>
                             <p className="text-xs text-neutral-400 truncate">{song.albums?.artists?.name}</p>
                           </div>
                         </div>

                         <div className="flex items-center gap-x-3 pl-2" onClick={(e) => e.stopPropagation()}>
                             <AddToQueueButton songId={song.id} />
                             <LikeButton songId={song.id} />
                         </div>
                       </div>
                   </SongContextMenu>
                 ))}
               </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================== */}
      {/* 📱 MOBILE FULL-SCREEN OVERLAY                              */}
      {/* ========================================================== */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="md:hidden fixed inset-0 z-[200] bg-black flex flex-col pt-4 pb-20"
          >
            {/* Top Close / Input Bar */}
            <div className="flex items-center gap-x-2 px-4 pb-4 border-b border-neutral-800 shrink-0">
               <button 
                 onClick={() => {
                   setIsMobileOpen(false);
                   setQuery("");
                 }}
                 className="p-2 -ml-2 text-white active:scale-95 transition"
               >
                 <IoMdClose size={28} />
               </button>
               
               <div className="flex-1 relative flex items-center bg-neutral-800 rounded-full px-4 py-2">
                  <BiSearch className="text-neutral-400 shrink-0" size={20} />
                  <input 
                    ref={mobileInputRef}
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="What do you want to listen to?"
                    className="bg-transparent border-none outline-none text-white ml-2 w-full placeholder:text-neutral-400 text-sm font-medium pr-8" 
                  />
                  {query && (
                    <div 
                      onClick={() => {
                         setQuery("");
                         mobileInputRef.current?.focus();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer p-2"
                    >
                      <IoMdClose size={20} />
                    </div>
                  )}
               </div>
            </div>

            {/* Scrollable Results Container */}
            <div onScroll={handleScroll} className="flex-1 w-full flex flex-col overflow-y-auto scrollbar-hide px-4 pt-4">
              
              {/* MOBILE HISTORY VIEW */}
              {query === "" && history.length > 0 && (
                <div className="flex flex-col">
                  <h3 className="text-sm font-bold text-neutral-100 mb-4 px-1">Recent searches</h3>
                  {history.map(item => {
                    const bucket = item.item_type === 'artist' ? 'artist_images' : item.item_type === 'playlist' ? 'playlist_images' : 'images';
                    const path = item.image_path || (
                        item.item_type === 'playlist' ? 'playlist-placeholder.jpg' : 
                        (item.item_type === 'song' || item.item_type === 'album') ? 'sample.jpg' : 
                        null
                    );

                    return (
                      <SwipeableHistoryItem
                         key={item.id}
                         item={item}
                         bucket={bucket}
                         path={path}
                         getImageUrl={getImageUrl}
                         onClick={() => {
                            handleHistoryClick(item);
                            setIsMobileOpen(false);
                         }}
                         onRemove={() => removeFromHistory(item.id)}
                         onAddToQueue={item.item_type === 'song' ? () => player.addToQueue(item.item_id) : undefined}
                      />
                    );
                  })}
                  <button onClick={clearAllHistory} className="mt-4 p-2 text-sm font-bold text-neutral-300 hover:text-white active:scale-95 self-start px-1">
                    Clear recent searches
                  </button>
                </div>
              )}

              {/* MOBILE LIVE QUERY VIEW */}
              {query.length > 0 && hasResults && (
                <div className="flex flex-col gap-y-6 pb-6">
                  
                  {/* Artists */}
                  {results.artists.length > 0 && (
                    <div className="flex flex-col">
                       <h3 className="text-sm font-bold text-neutral-100 mb-3 px-1">Artists</h3>
                       <MediaContextMenu data={{ id: results.artists[0].id, type: 'artist', title: results.artists[0].name }}>
                           <div onClick={() => handleSearchResultClick(results.artists[0], 'artist')} className="flex items-center gap-x-3 p-1 rounded-md cursor-pointer w-full active:bg-neutral-800">
                              <div className="relative h-12 w-12 rounded-full overflow-hidden shrink-0">
                                 <Image fill src={getImageUrl(results.artists[0].image_path, 'artist_images')} alt={results.artists[0].name} className="object-cover" unoptimized onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }} />
                              </div>
                              <p className="font-medium text-[15px] text-white">{results.artists[0].name}</p>
                           </div>
                       </MediaContextMenu>
                    </div>
                  )}

                  {/* Playlists */}
                  {results.playlists.length > 0 && (
                     <div className="flex flex-col">
                        <h3 className="text-sm font-bold text-neutral-100 mb-3 px-1">Playlists</h3>
                        {results.playlists.map(playlist => (
                           <MediaContextMenu key={playlist.id} data={{ id: playlist.id, type: 'playlist', title: playlist.title }}>
                               <div onClick={() => handleSearchResultClick(playlist, 'playlist')} className="flex items-center gap-x-3 p-1 rounded-md cursor-pointer w-full active:bg-neutral-800 mb-2">
                                 <div className="relative h-12 w-12 min-w-[48px] overflow-hidden shrink-0">
                                     <Image fill src={getImageUrl(playlist._unified_image || 'playlist-placeholder.jpg', 'playlist_images')} alt={playlist.title} className="object-cover" unoptimized onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }} />
                                  </div>
                                  <div className="flex flex-col overflow-hidden">
                                     <p className="text-[15px] font-medium text-white truncate">{playlist.title}</p>
                                     <p className="text-xs text-neutral-400 truncate">Playlist</p>
                                  </div>
                               </div>
                           </MediaContextMenu>
                        ))}
                     </div>
                  )}

                  {/* Albums */}
                  {results.albums.length > 0 && (
                     <div className="flex flex-col">
                        <h3 className="text-sm font-bold text-neutral-100 mb-3 px-1">Albums</h3>
                        {results.albums.map(album => (
                           <MediaContextMenu key={album.id} data={{ id: album.id, type: 'album', title: album.title, artist_id: album.artists?.id }}>
                               <div onClick={() => handleSearchResultClick(album, 'album')} className="flex items-center gap-x-3 p-1 rounded-md cursor-pointer w-full active:bg-neutral-800 mb-2">
                                 <div className="relative h-12 w-12 min-w-[48px] overflow-hidden shrink-0">
                                     <Image fill src={getImageUrl(album.image_path || 'sample.jpg')} alt={album.title} className="object-cover" unoptimized onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }} />
                                  </div>
                                  <div className="flex flex-col overflow-hidden">
                                     <p className="text-[15px] font-medium text-white truncate">{album.title}</p>
                                     <p className="text-xs text-neutral-400 truncate">Album • {album.artists?.name}</p>
                                  </div>
                               </div>
                           </MediaContextMenu>
                        ))}
                     </div>
                  )}

                  {/* Songs */}
                  {results.songs.length > 0 && (
                    <div className="flex flex-col">
                       <h3 className="text-sm font-bold text-neutral-100 mb-3 px-1">Songs</h3>
                       <div className="flex flex-col gap-y-2">
                         {results.songs.slice(0, visibleSongCount).map((song) => (
                           <SongContextMenu key={song.id} songId={song.id}>
                               <SwipeableSongItem
                                  song={song}
                                  getImageUrl={getImageUrl}
                                  onClick={() => handleSearchResultClick(song, 'song')}
                                  onAddToQueue={() => player.addToQueue(song.id)}
                               >
                                 <div className="flex items-center gap-x-3 pl-2" onClick={(e) => e.stopPropagation()}>
                                     <LikeButton songId={song.id} />
                                 </div>
                               </SwipeableSongItem>
                           </SongContextMenu>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
              )}

              {/* No Results Empty State */}
              {query.length > 0 && !hasResults && (
                <div className="flex flex-col items-center justify-center mt-20 px-8 text-center text-neutral-400">
                  <h3 className="text-white font-bold text-xl mb-2">Couldn't find "{query}"</h3>
                  <p className="text-sm">Try searching again using a different spelling or keyword.</p>
                </div>
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default GlobalSearch;