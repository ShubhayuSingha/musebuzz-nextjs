// src/types/index.ts

// --- 1. Database Tables ---

export interface Song {
  id: string;
  created_at: string;
  title: string;
  song_path: string;
  image_path: string;     
  duration_seconds: number; 
  album_id: string;
  albums?: Album; 
}

export interface Album {
  id: string;
  created_at: string;
  title: string;
  image_path: string;
  artist_id: string;
  genre: string;
  release_type: 'album' | 'single'; 
  artists?: Artist; 
  songs?: Song[];
}

export interface Artist {
  id: string;
  created_at: string;
  name: string;
  image_path: string;
}

// 🟢 UPDATED: Playlist now supports both Custom and Generated types
export interface Playlist {
  id: string;
  created_at: string;
  title: string;
  user_id: string;
  
  // Custom Playlists use 'image_path' (Supabase Storage)
  image_path?: string; 
  
  // Generated Playlists use 'image_url' (External Link)
  image_url?: string;  

  description?: string;
  type?: 'personal' | 'daily_mix' | 'genre_mix'; 
  song_ids?: string[]; 
}

export interface UserDetails { 
  id: string;
  updated_at: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

// --- 2. Playback & Queue Types ---

export interface QueueItem {
  id: string;       
  uid: string;      
}

export interface PlaybackState {
  user_id: string;
  active_song_id: string | null;
  is_playing: boolean;
  volume: number;
  progress_ms: number;
  repeat_mode: 'off' | 'context' | 'one';
  shuffle_mode: boolean;
  updated_at: string;
  queue_state: {
    bucket_a: string[];        
    bucket_b: QueueItem[];     
    shuffled_order: string[];  
    active_id?: string | null; 
  }
}