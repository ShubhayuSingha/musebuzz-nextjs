'use client';

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BiSearch } from "react-icons/bi";
import { IoMdClose } from "react-icons/io"; 
import { useSearch } from "@/hooks/useSearch";
import Image from "next/image";
import usePlayerStore from "@/stores/usePlayerStore";
import { BsPlayFill } from "react-icons/bs";
import { supabase } from "@/lib/supabaseClient";

import LikeButton from "@/components/LikeButton";
import AddToQueueButton from "@/components/AddToQueueButton";
import SongContextMenu from "@/components/SongContextMenu";
import MediaContextMenu from "@/components/MediaContextMenu";

const PLACEHOLDER_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const GlobalSearch = () => {
  const router = useRouter();
  const { searchAll } = useSearch();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null); 
  
  const player = usePlayerStore();

  const results = searchAll(query);
  const hasResults = results.songs.length > 0 || results.albums.length > 0 || results.artists.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 🟢 1. Ignore Standard Right Click (Context Menu trigger)
      if (event.button === 2) return;

      // 🟢 2. Ignore Ctrl+Click (Mac Right Click emulation)
      if (event.ctrlKey) return;

      const target = event.target as Element;

      // 🟢 3. Check if inside Search Container
      const isInsideSearch = containerRef.current && containerRef.current.contains(target);

      // 🟢 4. Check if inside ANY Radix Portal (Context Menu, Dropdown, etc.)
      // This is the most robust check. It looks for the specific attribute Radix adds to its content.
      const isInsideRadixContent = target.closest('[data-radix-context-menu-content]');

      // Only close if we are OUTSIDE the search AND OUTSIDE any context menu
      if (!isInsideSearch && !isInsideRadixContent) {
        setIsOpen(false);
      }
    };

    // Use 'mousedown' to catch the click before 'mouseup' triggers other actions
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSongPlay = (id: string) => {
    player.setId(id);
    player.setIds([id]); 
  };

  const clearSearch = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    setQuery("");
    inputRef.current?.focus();
  };

  const getImageUrl = (path: string | null, bucket: string = 'images') => {
    if (!path) return PLACEHOLDER_IMAGE;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[400px] z-50">
      {/* SEARCH BAR */}
      <div 
        onClick={() => inputRef.current?.focus()}
        className="relative flex items-center bg-neutral-800 rounded-full px-4 py-3 group focus-within:ring-2 focus-within:ring-white transition cursor-text"
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
          placeholder="Search songs, albums, artists..."
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

      {/* FLOATING WINDOW */}
      {isOpen && query.length > 0 && hasResults && (
        <div className="absolute top-[110%] left-0 w-full bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden animate-fade-in p-2 flex flex-col gap-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* 1. TOP ARTIST */}
          {results.artists.length > 0 && (
            <div className="p-2">
               <h3 className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">Top Artist</h3>
               <MediaContextMenu 
                  data={{ 
                      id: results.artists[0].id, 
                      type: 'artist', 
                      title: results.artists[0].name 
                  }}
               >
                   <div 
                     onClick={() => router.push(`/artist/${results.artists[0].id}`)}
                     className="flex items-center gap-x-3 hover:bg-neutral-800 p-2 rounded-md cursor-pointer transition w-full"
                   >
                      <div className="relative h-12 w-12 rounded-full overflow-hidden shrink-0">
                         <Image 
                           fill 
                           src={getImageUrl(results.artists[0].image_path, 'artist_images')} 
                           alt={results.artists[0].name} 
                           className="object-cover"
                           unoptimized 
                         />
                      </div>
                      <p className="font-bold text-white">{results.artists[0].name}</p>
                   </div>
               </MediaContextMenu>
            </div>
          )}

          {/* 2. TOP SONGS */}
          {results.songs.length > 0 && (
            <div className="p-2">
               <h3 className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">Songs</h3>
               <div className="flex flex-col gap-y-1">
                 {results.songs.map((song) => (
                   <SongContextMenu key={song.id} songId={song.id}>
                       <div 
                         onClick={() => handleSongPlay(song.id)}
                         className="flex items-center justify-between p-2 rounded-md hover:bg-neutral-800 cursor-pointer group"
                       >
                         <div className="flex items-center gap-x-3 overflow-hidden">
                           <div className="relative h-10 w-10 min-w-[40px] overflow-hidden rounded-md shrink-0">
                             <Image 
                               fill 
                               src={getImageUrl(song.albums?.image_path)}
                               alt={song.title} 
                               className="object-cover"
                               unoptimized 
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

          {/* 3. ALBUMS */}
          {results.albums.length > 0 && (
             <div className="p-2">
                <h3 className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">Albums</h3>
                {results.albums.map(album => (
                   <MediaContextMenu 
                      key={album.id}
                      data={{
                        id: album.id,
                        type: 'album',
                        title: album.title,
                        artist_id: album.artists?.id 
                      }}
                   >
                       <div 
                         onClick={() => router.push(`/album/${album.id}`)}
                         className="flex items-center gap-x-3 p-2 rounded-md hover:bg-neutral-800 cursor-pointer w-full"
                       >
                          <div className="relative h-10 w-10 min-w-[40px] overflow-hidden rounded-md shrink-0">
                             <Image 
                               fill 
                               src={getImageUrl(album.image_path)} 
                               alt={album.title} 
                               className="object-cover"
                               unoptimized 
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

        </div>
      )}
    </div>
  );
};

export default GlobalSearch;