// src/types/index.ts

// --- 1. Database Tables (Strictly matching your Schema) ---

export interface Song {
  id: string;
  created_at: string;
  title: string;
  song_path: string;
  image_path: string;     // Note: You usually fetch this via the Album linkage, but keeping if you flat-map it
  duration_seconds: number; // Changed from 'int8' to number
  album_id: string;
  
  // Joined Data (Optional: Available when you select *, albums(*))
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

  // Joined Data
  artists?: Artist; 
  songs?: Song[];
}

export interface Artist {
  id: string;
  created_at: string;
  name: string;
  image_path: string;
}

export interface Playlist {
  id: string;
  created_at: string;
  title: string;
  image_path: string;
  user_id: string;
}

export interface UserDetails { // Matches 'profiles' table
  id: string;
  updated_at: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

// --- 2. Playback & Queue Types (Stored in playback_state JSONB) ---

// A Single Item in the Priority Queue (Bucket B)
export interface QueueItem {
  id: string;          // The actual Song ID
  uid: string;         // Unique ID for this specific spot in line
}

// The Master State Object (Matches 'playback_state' columns + JSON structure)
export interface PlaybackState {
  user_id: string;
  active_song_id: string | null;
  is_playing: boolean;
  volume: number;
  progress_ms: number;
  repeat_mode: 'off' | 'context' | 'one';
  shuffle_mode: boolean;
  updated_at: string;
  
  // The JSONB column 'queue_state' expands into this:
  queue_state: {
    bucket_a: string[];        // Array of Song IDs (The Album/Playlist context)
    bucket_b: QueueItem[];     // Array of QueueItems (The Priority Queue)
    shuffled_order: string[];  // Array of Song IDs (Randomized Bucket A)
    active_id?: string | null; // (Redundant but sometimes stored in JSON for easy access)
  }
}