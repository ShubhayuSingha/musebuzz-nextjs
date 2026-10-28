// src/lib/offlineDb.ts
import Dexie, { type Table } from 'dexie';

export interface OfflineSong {
  id: string;
  title: string;
  duration_seconds?: number | null;
  album_id?: string;
  song_path: string;
  audio_url?: string;
  imageUrl?: string | null;        // top-level cached image URL (used by player)
  lyrics_snippet?: string | null;
  downloaded_at?: number;
  albums?: {
    id: string;
    title: string;
    image_path?: string | null;
    image_url?: string | null;     // resolved CDN URL for the album cover
    genre?: string | null;
    release_type?: string | null;
    artists?: {
      id: string;
      name: string;
    };
  };
}

export interface OfflinePlaylistSong {
  created_at?: string;
  song_order: number;
  songs: OfflineSong;
}

export interface OfflinePlaylist {
  id: string;
  title: string;
  image_path?: string | null;
  image_url?: string | null;
  user_id?: string;
  created_at?: string;
  downloaded_at: number;
  last_accessed_at?: string | null;
  playlist_songs: OfflinePlaylistSong[];
}

export interface OfflineAlbum {
  id: string;
  title: string;
  image_path?: string | null;
  image_url?: string | null;
  genre?: string | null;
  release_type?: string | null;
  artist_id?: string;
  created_at?: string;
  downloaded_at: number;
  last_accessed_at?: string | null;
  artists?: {
    id: string;
    name: string;
    image_path?: string | null;
  };
  songs: OfflineSong[];
}

export interface OfflineSongReference {
  id: string; // `${song_id}_${parent_type}_${parent_id}`
  song_id: string;
  parent_type: 'playlist' | 'album';
  parent_id: string;
  created_at: number;
}

export interface OfflineSavedAlbum {
  user_id: string;
  album_id: string;
  downloaded_at: number;
  last_accessed_at?: string | null;
  created_at?: string;
}

export interface OfflineLikedSong {
  user_id: string;
  song_id: string;
  created_at?: string;
  song_order?: number;
}

export interface OfflineArtist {
  id: string;
  name: string;
  image_path?: string | null;
  image_url?: string | null;
  created_at?: string;
}

export interface OfflinePlaybackState {
  user_id: string;
  active_song_id?: string | null;
  is_playing?: boolean;
  volume?: number;
  progress_ms?: number;
  queue_state?: any;
  repeat_mode?: string;
  shuffle_mode?: boolean;
  updated_at: number;
}

export class MuseBuzzOfflineDB extends Dexie {
  playlists!: Table<OfflinePlaylist, string>;
  albums!: Table<OfflineAlbum, string>;
  songs!: Table<OfflineSong, string>;
  song_references!: Table<OfflineSongReference, string>;
  playback_state!: Table<OfflinePlaybackState, string>;
  saved_albums!: Table<OfflineSavedAlbum, [string, string]>;
  liked_songs!: Table<OfflineLikedSong, [string, string]>;
  artists!: Table<OfflineArtist, string>;

  constructor() {
    super('musebuzz-offline-db');

    // Schema version 1: Initial baseline
    this.version(1).stores({
      playlists: 'id, title, user_id, downloaded_at',
      albums: 'id, title, artist_id, downloaded_at',
      songs: 'id, title, album_id, song_path, downloaded_at',
      song_references: 'id, song_id, parent_type, parent_id, [parent_type+parent_id]',
      playback_state: 'user_id, updated_at'
    });

    // Schema version 2: Multi-user relational mirroring Supabase
    this.version(2).stores({
      playlists: 'id, title, user_id, downloaded_at, last_accessed_at',
      albums: 'id, title, artist_id, downloaded_at',
      songs: 'id, title, album_id, song_path, downloaded_at',
      song_references: 'id, song_id, parent_type, parent_id, [parent_type+parent_id]',
      playback_state: 'user_id, updated_at',
      saved_albums: '[user_id+album_id], user_id, album_id, downloaded_at',
      liked_songs: '[user_id+song_id], user_id, song_id, created_at',
      artists: 'id, name'
    });
  }
}

// Global singleton instance
export const offlineDb = new MuseBuzzOfflineDB();
