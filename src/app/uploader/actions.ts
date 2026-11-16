'use server';

import { createClient } from '@supabase/supabase-js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zniinqiqnwndnowzzjyt.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getAdminClient() {
  if (process.env.VERCEL === '1') {
    throw new Error('Uploader actions are restricted to localhost only.');
  }
  if (!serviceKey) {
    throw new Error('Supabase Service Role Key is missing. Check .env.local');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s.-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Server action to fetch any remote image (bypassing CORS) and return as base64
 */
export async function fetchRemoteImageAsBase64(imageUrl: string) {
  try {
    const parsed = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, error: 'Invalid URL protocol' };
    }

    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      return { success: false, error: `Failed to download image (HTTP ${res.status})` };
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;

    return { success: true, base64 };
  } catch (err: any) {
    console.error('[fetchRemoteImageAsBase64] Error:', err);
    return { success: false, error: err?.message || 'Failed to fetch image URL' };
  }
}

/**
 * Fetch all artists or search artists by keyword
 */
export async function getArtists(query: string = '') {
  try {
    const supabase = getAdminClient();
    let q = supabase
      .from('artists')
      .select('id, name, image_path')
      .order('name', { ascending: true });

    if (query.trim()) {
      q = q.ilike('name', `%${query.trim()}%`);
    }

    const { data, error } = await q.limit(1000);
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch artists', data: [] };
  }
}

/**
 * Fetch albums belonging to a specific artist
 */
export async function getAlbumsForArtist(artistId: string) {
  try {
    if (!artistId) return { success: true, data: [] };
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('albums')
      .select('id, title, image_path, genre, release_type')
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch albums', data: [] };
  }
}

/**
 * Create a new Artist
 */
export async function createArtist(formData: FormData) {
  try {
    const supabase = getAdminClient();
    const name = (formData.get('name') as string)?.trim();
    if (!name) return { success: false, error: 'Artist name is required' };

    let imagePath: string | null = null;
    const imageFile = formData.get('image') as File | null;

    if (imageFile && imageFile.size > 0) {
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const cleanName = sanitizeFilename(name);
      const filename = `${cleanName}-${Date.now()}.${ext}`;

      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('artist_images')
        .upload(filename, buffer, {
          contentType: imageFile.type || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('[createArtist] Storage upload warning:', uploadError);
      } else {
        imagePath = uploadData?.path || filename;
      }
    }

    const { data, error } = await supabase
      .from('artists')
      .insert({
        name,
        image_path: imagePath,
      })
      .select('id, name, image_path')
      .single();

    if (error) throw error;
    return { success: true, artist: data };
  } catch (err: any) {
    console.error('[createArtist] Error:', err);
    return { success: false, error: err?.message || 'Failed to create artist' };
  }
}

/**
 * Create a new Album
 */
export async function createAlbum(formData: FormData) {
  try {
    const supabase = getAdminClient();
    const title = (formData.get('title') as string)?.trim();
    const artistId = (formData.get('artist_id') as string)?.trim();
    const genre = (formData.get('genre') as string)?.trim() || null;
    const releaseType = (formData.get('release_type') as string)?.trim() || 'album';

    if (!title) return { success: false, error: 'Album title is required' };
    if (!artistId) return { success: false, error: 'Artist selection is required' };

    let imagePath: string | null = null;
    const imageFile = formData.get('image') as File | null;

    if (imageFile && imageFile.size > 0) {
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const cleanTitle = sanitizeFilename(title);
      const filename = `${cleanTitle}-${Date.now()}.${ext}`;

      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('images')
        .upload(filename, buffer, {
          contentType: imageFile.type || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.warn('[createAlbum] Storage upload warning:', uploadError);
      } else {
        imagePath = uploadData?.path || filename;
      }
    }

    const { data, error } = await supabase
      .from('albums')
      .insert({
        title,
        artist_id: artistId,
        genre,
        release_type: releaseType,
        image_path: imagePath,
      })
      .select('id, title, image_path, artist_id, genre, release_type')
      .single();

    if (error) throw error;
    return { success: true, album: data };
  } catch (err: any) {
    console.error('[createAlbum] Error:', err);
    return { success: false, error: err?.message || 'Failed to create album' };
  }
}

/**
 * Extracts exact media duration in seconds using ffprobe
 */
async function getFileDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const val = parseFloat(stdout.trim());
    return isNaN(val) ? 0 : val;
  } catch (err) {
    return 0;
  }
}

/**
 * Processes an audio buffer with optional:
 * 1. EBU R128 loudness normalization (-14 LUFS, TP -1.5 dBTP)
 * 2. Trailing silence trimming (cuts long dead gaps at the end of tracks >= 0.5s)
 */
async function processAudio(
  inputBuffer: Buffer,
  ext: string,
  options: { normalize: boolean; trimSilence: boolean }
): Promise<{ buffer: Buffer; durationSeconds: number; originalDurationSeconds: number; trimmedSeconds: number }> {
  const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'mp3';
  const tempDir = os.tmpdir();
  const uniqueId = `proc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const inputFilePath = path.join(tempDir, `${uniqueId}-input.${cleanExt}`);
  const outputFilePath = path.join(tempDir, `${uniqueId}-output.${cleanExt}`);

  try {
    await fs.writeFile(inputFilePath, inputBuffer);

    const origDuration = await getFileDuration(inputFilePath);

    // Build audio filter chain
    const filters: string[] = [];
    if (options.normalize) {
      // EBU R128 loudness target -14 LUFS, True Peak -1.5 dBTP
      filters.push('loudnorm=I=-14:TP=-1.5:LRA=11');
    }
    if (options.trimSilence) {
      // Strip trailing silence >= 0.5s with volume < -50dB
      filters.push('areverse,silenceremove=start_periods=1:start_duration=0.5:start_threshold=-50dB,areverse');
    }

    let codecArgs: string[] = [];
    if (cleanExt === 'mp3') {
      codecArgs = ['-c:a', 'libmp3lame', '-b:a', '320k'];
    } else if (cleanExt === 'opus') {
      codecArgs = ['-c:a', 'libopus', '-b:a', '192k'];
    } else if (cleanExt === 'm4a' || cleanExt === 'aac') {
      codecArgs = ['-c:a', 'aac', '-b:a', '256k'];
    } else if (cleanExt === 'flac') {
      codecArgs = ['-c:a', 'flac'];
    } else if (cleanExt === 'ogg') {
      codecArgs = ['-c:a', 'libvorbis', '-q:a', '7'];
    } else if (cleanExt === 'wav') {
      codecArgs = ['-c:a', 'pcm_s16le'];
    } else {
      codecArgs = ['-c:a', 'libmp3lame', '-b:a', '320k'];
    }

    const args = [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', inputFilePath,
      ...(filters.length > 0 ? ['-af', filters.join(',')] : []),
      ...codecArgs,
      outputFilePath,
    ];

    await execFileAsync('ffmpeg', args, { timeout: 120000 });

    const processedBuffer = await fs.readFile(outputFilePath);
    const newDuration = await getFileDuration(outputFilePath);

    const durationSeconds = Math.round(newDuration || origDuration);
    const originalDurationSeconds = Math.round(origDuration);
    const trimmedSeconds = Math.max(0, originalDurationSeconds - durationSeconds);

    return {
      buffer: processedBuffer,
      durationSeconds,
      originalDurationSeconds,
      trimmedSeconds,
    };
  } catch (err: any) {
    console.warn('[processAudio] Warning during audio processing (falling back to original audio):', err?.message || err);
    return {
      buffer: inputBuffer,
      durationSeconds: 0,
      originalDurationSeconds: 0,
      trimmedSeconds: 0,
    };
  } finally {
    try { await fs.unlink(inputFilePath); } catch {}
    try { await fs.unlink(outputFilePath); } catch {}
  }
}

/**
 * Server action to process an audio track for A/B comparison and preview
 */
export async function processAudioPreview(formData: FormData) {
  try {
    if (process.env.VERCEL === '1') {
      return { success: false, error: 'Processing audio preview is restricted to localhost.' };
    }

    const audioFile = formData.get('audio') as File | null;
    const normalize = formData.get('normalize') !== 'false';
    const trimSilence = formData.get('trim_silence') !== 'false';

    if (!audioFile || audioFile.size === 0) {
      return { success: false, error: 'No audio file provided' };
    }

    const originalExt = audioFile.name.split('.').pop() || 'mp3';
    const bytes = await audioFile.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);

    const result = await processAudio(inputBuffer, originalExt, {
      normalize,
      trimSilence,
    });

    const mime = audioFile.type || `audio/${originalExt === 'mp3' ? 'mpeg' : originalExt}`;
    const base64 = `data:${mime};base64,${result.buffer.toString('base64')}`;

    return {
      success: true,
      audioBase64: base64,
      fileName: `processed_${audioFile.name}`,
      fileType: mime,
      durationSeconds: result.durationSeconds,
      originalDurationSeconds: result.originalDurationSeconds,
      trimmedSeconds: result.trimmedSeconds,
    };
  } catch (err: any) {
    console.error('[processAudioPreview] Error:', err);
    return { success: false, error: err?.message || 'Failed to process audio for preview' };
  }
}

/**
 * Upload song audio file and insert record into database
 */
export async function uploadSong(formData: FormData) {
  try {
    const supabase = getAdminClient();

    const title = (formData.get('title') as string)?.trim();
    const albumId = (formData.get('album_id') as string)?.trim();
    const artistName = (formData.get('artist_name') as string)?.trim() || '';
    const durationSeconds = parseInt((formData.get('duration_seconds') as string) || '0', 10);
    const language = (formData.get('language') as string)?.trim() || 'English';
    const narrationText = (formData.get('narration_text') as string)?.trim() || null;
    const rawTags = (formData.get('tags') as string)?.trim() || '';
    const normalizeAudio = formData.get('normalize_audio') !== 'false';
    const trimSilence = formData.get('trim_silence') !== 'false';
    const alreadyProcessed = formData.get('already_processed') === 'true';
    const audioFile = formData.get('audio') as File | null;

    if (!title) return { success: false, error: 'Song title is required' };
    if (!albumId) return { success: false, error: 'Album selection is required' };
    if (!audioFile || audioFile.size === 0) return { success: false, error: 'Audio file is required' };

    // Parse tags array
    const tagsArray = rawTags
      ? rawTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    // Determine extension & sanitized storage filename: e.g. "title_artist.mp3" or "title_artist.opus"
    const originalExt = audioFile.name.split('.').pop() || 'mp3';
    const cleanTitle = sanitizeFilename(title);
    const cleanArtist = sanitizeFilename(artistName);
    const baseSlug = cleanArtist ? `${cleanTitle}_${cleanArtist}` : cleanTitle;
    const filename = `${baseSlug}-${Date.now()}.${originalExt}`;

    // Read audio buffer
    const bytes = await audioFile.arrayBuffer();
    let buffer: Buffer<any> = Buffer.from(bytes);
    let finalDuration = durationSeconds;

    // Apply audio processing if not already processed on the client preview step
    if (!alreadyProcessed && (normalizeAudio || trimSilence)) {
      try {
        const procResult = await processAudio(buffer, originalExt, {
          normalize: normalizeAudio,
          trimSilence: trimSilence,
        });
        buffer = procResult.buffer;
        if (procResult.durationSeconds > 0) {
          finalDuration = procResult.durationSeconds;
        }
      } catch (procErr: any) {
        console.warn('[uploadSong] Audio processing bypassed due to error:', procErr?.message || procErr);
      }
    }

    const { data: storageData, error: storageError } = await supabase.storage
      .from('songs')
      .upload(filename, buffer, {
        contentType: audioFile.type || 'audio/mpeg',
        upsert: true,
      });

    if (storageError) {
      throw new Error(`Audio upload failed: ${storageError.message}`);
    }

    const songPath = storageData?.path || filename;

    // Insert song row in PostgreSQL
    const { data, error: dbError } = await supabase
      .from('songs')
      .insert({
        title,
        album_id: albumId,
        song_path: songPath,
        duration_seconds: finalDuration || 180,
        language: language || 'English',
        tags: tagsArray,
        narration_text: narrationText,
        lyrics_snippet: null,
      })
      .select('id, title, song_path, album_id, duration_seconds')
      .single();

    if (dbError) {
      // Clean up orphaned audio file if DB insert fails
      await supabase.storage.from('songs').remove([songPath]);
      throw dbError;
    }

    return { success: true, song: data };
  } catch (err: any) {
    console.error('[uploadSong] Error:', err);
    return { success: false, error: err?.message || 'Failed to upload song' };
  }
}

