'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { BsMusicNoteBeamed } from 'react-icons/bs';
import { FiEdit2, FiTrash } from 'react-icons/fi'; 
import { HiCheck, HiX } from 'react-icons/hi'; 
import { RiWifiOffLine } from 'react-icons/ri';
import usePlaylistStore from '@/stores/usePlaylistStore';
import useOfflineModeStore from '@/stores/useOfflineModeStore';
import DownloadButton from '@/components/DownloadButton';

interface PlaylistHeaderProps {
  playlist: any;
  imageUrl: string;
  fallbackImageUrl?: string;
  songsCount: number;
}

const PlaylistHeader: React.FC<PlaylistHeaderProps> = ({ 
  playlist, 
  imageUrl, 
  fallbackImageUrl,
  songsCount 
}) => {
  const router = useRouter();
  const supabaseClient = useSupabaseClient();
  const user = useUser();
  
  const { refreshPlaylists } = usePlaylistStore();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description || ''); 
  const [isLoading, setIsLoading] = useState(false);

  const [currentImgSrc, setCurrentImgSrc] = useState(imageUrl || fallbackImageUrl || '');
  const [hasImageError, setHasImageError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCurrentImgSrc(imageUrl || fallbackImageUrl || '');
    setHasImageError(false);
  }, [imageUrl, fallbackImageUrl]);

  const { isOnline, isOfflineMode } = useOfflineModeStore();
  const isOffline = mounted && (!isOnline || isOfflineMode);

  // --- SAVE LOGIC ---
  const handleSave = async () => {
    if (!isOnline || isOfflineMode) {
      return toast.error("Editing playlists is not available offline");
    }

    if (!title.trim()) return toast.error("Title cannot be empty");
    if (title.length > 50) return toast.error("Title must be less than 50 characters");
    if (description.length > 100) return toast.error("Description must be less than 100 characters");

    setIsLoading(true);

    const { error } = await supabaseClient
      .from('playlists')
      .update({ title, description })
      .eq('id', playlist.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Playlist updated');
      setIsEditing(false);
      refreshPlaylists();
      router.refresh(); 
    }
    setIsLoading(false);
  };

  // --- DELETE LOGIC ---
  const handleDelete = async () => {
    if (!isOnline || isOfflineMode) {
      return toast.error("Deleting playlists is not available offline");
    }

    setIsLoading(true);

    const { error } = await supabaseClient
      .from('playlists')
      .delete()
      .eq('id', playlist.id);

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
    } else {
      toast.success('Playlist deleted');
      refreshPlaylists(); 
      router.refresh();
      router.push('/'); 
    }
  };

  // 🟢 SIZING LOGIC
  const titleLength = title.length;
  let titleSizeClass = "text-4xl sm:text-5xl lg:text-6xl"; 
  if (titleLength > 40) titleSizeClass = "text-2xl sm:text-3xl lg:text-4xl"; 
  else if (titleLength > 15) titleSizeClass = "text-3xl sm:text-4xl lg:text-5xl"; 

  const isOwner = user?.id === playlist.user_id;

  return (
    <>
      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-neutral-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
           <div className="bg-neutral-800 border border-neutral-700 p-6 rounded-lg shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
              <h2 className="text-xl font-bold text-white mb-2">Delete Playlist?</h2>
              <p className="text-neutral-400 text-sm mb-6">
                 Are you sure you want to delete <span className="text-white font-semibold">{title}</span>? This action cannot be undone.
              </p>
              
              <div className="flex justify-end gap-x-3">
                 <button 
                    disabled={isLoading}
                    onClick={() => setShowDeleteModal(false)}
                    className="
                       px-4 py-2 text-sm font-medium text-neutral-300 
                       hover:text-white transition
                    "
                 >
                    Cancel
                 </button>
                 <button 
                    disabled={isLoading}
                    onClick={handleDelete}
                    className="
                       px-4 py-2 text-sm font-bold bg-red-500 text-white rounded-full
                       hover:bg-red-600 hover:scale-105 transition
                       disabled:opacity-50 disabled:cursor-not-allowed
                    "
                 >
                    {isLoading ? 'Deleting...' : 'Delete'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* HEADER CONTENT */}
      <div className="bg-gradient-to-b from-purple-900 to-black w-full">
          <div className="p-6">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-x-5">
              
              {/* IMAGE (Fixed Height: h-32 on mobile, h-52 on desktop) */}
              <div className="
                relative h-32 w-32 lg:h-52 lg:w-52 rounded-md 
                overflow-hidden shadow-2xl flex-shrink-0 bg-neutral-800 
                flex items-center justify-center
              ">
                {!hasImageError && currentImgSrc ? (
                  <Image 
                    unoptimized 
                    fill 
                    sizes="(max-width: 768px) 128px, 208px"
                    src={currentImgSrc} 
                    alt={playlist.title} 
                    className="object-cover" 
                    onError={() => {
                      if (fallbackImageUrl && currentImgSrc !== fallbackImageUrl) {
                        setCurrentImgSrc(fallbackImageUrl);
                      } else {
                        setHasImageError(true);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-800 via-indigo-950 to-neutral-900 flex items-center justify-center">
                    <BsMusicNoteBeamed size={56} className="text-white/60 drop-shadow" />
                  </div>
                )}
              </div>

              {/* TEXT CONTENT */}
              {/* 🟢 FIXED: Added 'min-w-0' to fix the wrap issue and 'lg:h-52' to lock height */}
              <div className="
                  flex flex-col gap-y-2 mt-4 md:mt-0 mb-2 w-full flex-1 min-w-0 
                  justify-end lg:h-52
              ">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-xs md:text-sm text-neutral-200 uppercase tracking-wider">
                    Playlist
                  </p>
                  {mounted && (!isOnline || isOfflineMode) && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1 select-none">
                      <RiWifiOffLine className="w-3 h-3" /> Offline
                    </span>
                  )}
                </div>
                
                {/* EDIT FORM */}
                {isEditing ? (
                   <div className="flex flex-col gap-y-3 my-2 w-full max-w-lg">
                      <input 
                        autoFocus disabled={isLoading} maxLength={50}
                        value={title} onChange={(e) => setTitle(e.target.value)}
                        placeholder="Playlist Name"
                        className={`font-bold text-white bg-neutral-800/50 border-b border-white outline-none px-2 py-1 w-full ${titleSizeClass}`}
                      />
                      <div className="relative">
                          <textarea 
                            disabled={isLoading} maxLength={100}
                            value={description} onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add an optional description" rows={2}
                            className="text-sm text-neutral-300 bg-neutral-800/50 border-b border-white/20 outline-none px-2 py-1 w-full resize-none"
                          />
                          <span className="absolute bottom-1 right-2 text-[10px] text-neutral-500">
                             {description.length}/100
                          </span>
                      </div>
                      <div className="flex gap-x-2">
                        <button onClick={handleSave} disabled={isLoading} className="p-2 bg-green-500 rounded-full hover:scale-110 transition flex items-center justify-center">
                           <HiCheck size={20} className="text-black" />
                        </button>
                        <button onClick={() => { setIsEditing(false); setTitle(playlist.title); setDescription(playlist.description || ''); }} disabled={isLoading} className="p-2 bg-neutral-700 rounded-full hover:bg-neutral-600 transition flex items-center justify-center">
                           <HiX size={20} className="text-white" />
                        </button>
                      </div>
                   </div>
                ) : (
                  // VIEW MODE
                  <div className="group flex flex-col gap-y-1">
                    <h1 className={`text-white font-bold drop-shadow-lg line-clamp-2 break-words leading-none pb-1 text-center md:text-left ${titleSizeClass}`}>
                      {title}
                    </h1>
                    
                    {description && (
                      <p className="text-neutral-400 text-sm font-medium line-clamp-2 max-w-2xl text-center md:text-left">
                        {description}
                      </p>
                    )}
                  </div>
                )}

                {!isEditing && (
                  <div className="flex items-center justify-center md:justify-start gap-x-2 mt-2">
                      <div className="relative h-6 w-6 rounded-full bg-neutral-500 flex items-center justify-center overflow-hidden">
                         <span className="text-[10px] text-black font-bold">U</span>
                      </div>
                      <p className="text-neutral-300 text-sm font-bold hover:underline cursor-pointer">
                         {isOwner ? 'You' : 'Unknown User'}
                      </p>
                      <span className="text-neutral-400 text-sm">•</span>
                      <p className="text-neutral-400 text-sm font-medium">
                         {songsCount} {songsCount === 1 ? 'song' : 'songs'}
                      </p>
                  </div>
                )}
              </div>
            </div>

            {/* ACTION CONTROLS ROW (Bottom part of header, on the left side) */}
            {!isEditing && (
              <div className="flex items-center justify-center md:justify-start gap-x-4 mt-6">
                {/* Download Button */}
                <DownloadButton id={playlist.id} type="playlist" title={title} />

                {isOwner && (
                  <div className="flex items-center gap-x-2">
                    <button 
                      onClick={() => {
                        if (!isOnline || isOfflineMode) {
                          toast.error("Editing playlists is disabled offline");
                          return;
                        }
                        setIsEditing(true);
                      }}
                      disabled={isOffline}
                      className={`
                        p-2.5 rounded-full transition
                        ${
                          isOffline
                            ? 'bg-neutral-800/30 text-neutral-600 cursor-not-allowed'
                            : 'bg-neutral-800/60 hover:bg-neutral-700 text-neutral-400 hover:text-white cursor-pointer hover:scale-105 active:scale-95'
                        }
                      `}
                      title={isOffline ? "Editing unavailable offline" : "Edit Details"}
                    >
                      <FiEdit2 size={19} />
                    </button>
                    <button 
                      onClick={() => {
                        if (!isOnline || isOfflineMode) {
                          toast.error("Deleting playlists is disabled offline");
                          return;
                        }
                        setShowDeleteModal(true);
                      }}
                      disabled={isOffline}
                      className={`
                        p-2.5 rounded-full transition
                        ${
                          isOffline
                            ? 'bg-neutral-800/30 text-neutral-600 cursor-not-allowed'
                            : 'bg-neutral-800/60 hover:bg-neutral-700 text-neutral-400 hover:text-red-500 cursor-pointer hover:scale-105 active:scale-95'
                        }
                      `}
                      title={isOffline ? "Deleting unavailable offline" : "Delete Playlist"}
                    >
                      <FiTrash size={19} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
      </div>
    </>
  );
}

export default PlaylistHeader;