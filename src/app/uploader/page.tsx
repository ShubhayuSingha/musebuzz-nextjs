'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { 
  HiCloudArrowUp, 
  HiMusicalNote, 
  HiSparkles, 
  HiCheckCircle, 
  HiArrowPath, 
  HiArrowTopRightOnSquare,
  HiClock,
  HiLanguage,
  HiTag,
  HiSpeakerWave,
  HiScissors,
  HiBolt,
  HiCheck
} from 'react-icons/hi2';

import { getArtists, getAlbumsForArtist, uploadSong, processAudioPreview } from './actions';
import { ArtistSelector } from './components/ArtistSelector';
import { AlbumSelector } from './components/AlbumSelector';
import { AudioUploadZone } from './components/AudioUploadZone';
import { NewArtistModal } from './components/NewArtistModal';
import { NewAlbumModal } from './components/NewAlbumModal';

interface Artist {
  id: string;
  name: string;
  image_path: string | null;
}

interface Album {
  id: string;
  title: string;
  image_path: string | null;
  genre: string | null;
  release_type: string;
}

const COMMON_LANGUAGES = [
  'English',
  'Hindi',
  'Bengali',
  'Punjabi',
  'Korean',
  'Japanese',
  'Spanish',
  'French',
  'Instrumental',
  'Other',
];

function base64ToFile(base64Data: string, filename: string, mimeType: string): File {
  const arr = base64Data.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || mimeType;
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export default function UploaderPage() {
  // Option 1 Guard: Lock uploader to localhost only. Block access on Vercel deployment (returns 404).
  if (process.env.VERCEL === '1') {
    notFound();
  }

  // Master lists
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(true);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);

  // Selected entities
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  // Modals state
  const [isArtistModalOpen, setIsArtistModalOpen] = useState(false);
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);

  // Song form state
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<string>('English');
  const [tags, setTags] = useState<string>('');
  const [narrationText, setNarrationText] = useState<string>('');

  // Audio files & Processing state
  const [originalAudioFile, setOriginalAudioFile] = useState<File | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [originalDuration, setOriginalDuration] = useState<number>(0);

  const [normalizeAudio, setNormalizeAudio] = useState<boolean>(true);
  const [trimSilence, setTrimSilence] = useState<boolean>(true);

  const [processedAudioBase64, setProcessedAudioBase64] = useState<string | null>(null);
  const [processedDuration, setProcessedDuration] = useState<number | null>(null);
  const [trimmedSeconds, setTrimmedSeconds] = useState<number>(0);
  const [isProcessingAudio, setIsProcessingAudio] = useState<boolean>(false);

  // Which version user chooses to upload: 'processed' (default) or 'original'
  const [selectedVersion, setSelectedVersion] = useState<'processed' | 'original'>('processed');
  const [durationSeconds, setDurationSeconds] = useState<number>(0);

  // Submission state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedSongData, setUploadedSongData] = useState<{
    id: string;
    title: string;
    albumId: string;
    artistId: string;
    artistName: string;
    albumTitle: string;
  } | null>(null);

  // Option 1 Client Guard: Ensure hostname is localhost / 127.0.0.1
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (!isLocal) {
        notFound();
      }
    }
  }, []);

  // Initial load: Fetch all artists
  useEffect(() => {
    async function loadArtists() {
      setIsLoadingArtists(true);
      const res = await getArtists('');
      if (res.success && res.data) {
        setArtists(res.data);
      } else {
        toast.error('Failed to load artists from database');
      }
      setIsLoadingArtists(false);
    }
    loadArtists();
  }, []);

  // When artist selection changes, fetch their albums
  useEffect(() => {
    async function loadAlbums() {
      if (!selectedArtist) {
        setAlbums([]);
        setSelectedAlbum(null);
        return;
      }
      setIsLoadingAlbums(true);
      const res = await getAlbumsForArtist(selectedArtist.id);
      if (res.success && res.data) {
        setAlbums(res.data);
        if (selectedAlbum && !res.data.some((a) => a.id === selectedAlbum.id)) {
          setSelectedAlbum(null);
        }
      }
      setIsLoadingAlbums(false);
    }
    loadAlbums();
  }, [selectedArtist]);

  // Clean up object URL when original audio changes
  useEffect(() => {
    return () => {
      if (originalAudioUrl) {
        URL.revokeObjectURL(originalAudioUrl);
      }
    };
  }, [originalAudioUrl]);

  // Handle audio file selection from AudioUploadZone
  const handleAudioSelected = (file: File | null, duration: number) => {
    if (originalAudioUrl) {
      URL.revokeObjectURL(originalAudioUrl);
    }

    setOriginalAudioFile(file);
    setOriginalDuration(duration);
    setDurationSeconds(duration);

    // Reset processed state
    setProcessedAudioBase64(null);
    setProcessedDuration(null);
    setTrimmedSeconds(0);
    setSelectedVersion('processed');

    if (file) {
      const url = URL.createObjectURL(file);
      setOriginalAudioUrl(url);

      // If title is currently empty and we got a file, infer a clean title
      if (!title.trim()) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const prettyName = nameWithoutExt
          .replace(/[_-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        setTitle(prettyName);
      }
    } else {
      setOriginalAudioUrl(null);
    }
  };

  // Trigger audio processing for A/B preview
  const handleProcessAudio = async () => {
    if (!originalAudioFile) {
      toast.error('Please upload an audio file first');
      return;
    }

    try {
      setIsProcessingAudio(true);
      toast.loading('Processing audio with FFmpeg (Normalizing & Trimming)...', { id: 'process-audio' });

      const formData = new FormData();
      formData.append('audio', originalAudioFile);
      formData.append('normalize', String(normalizeAudio));
      formData.append('trim_silence', String(trimSilence));

      const res = await processAudioPreview(formData);

      if (!res.success || !res.audioBase64) {
        throw new Error(res.error || 'Failed to process audio');
      }

      setProcessedAudioBase64(res.audioBase64);
      setProcessedDuration(res.durationSeconds || originalDuration);
      setTrimmedSeconds(res.trimmedSeconds || 0);
      setSelectedVersion('processed');

      // Update editable duration to the new trimmed duration
      if (res.durationSeconds && res.durationSeconds > 0) {
        setDurationSeconds(res.durationSeconds);
      }

      if (res.trimmedSeconds && res.trimmedSeconds > 0) {
        toast.success(
          `Processed! Normalized to -14 LUFS & cut ${res.trimmedSeconds}s trailing silence.`,
          { id: 'process-audio' }
        );
      } else {
        toast.success('Processed! Volume normalized to Spotify -14 LUFS standard.', { id: 'process-audio' });
      }
    } catch (err: any) {
      console.error('[handleProcessAudio] Error:', err);
      toast.error(err?.message || 'Processing failed. Check file format.', { id: 'process-audio' });
    } finally {
      setIsProcessingAudio(false);
    }
  };

  // Callback when a new artist is created via modal
  const handleArtistCreated = (newArtist: Artist) => {
    setArtists((prev) => [newArtist, ...prev.filter((a) => a.id !== newArtist.id)]);
    setSelectedArtist(newArtist);
    setSelectedAlbum(null);
  };

  // Callback when a new album is created via modal
  const handleAlbumCreated = (newAlbum: Album) => {
    setAlbums((prev) => [newAlbum, ...prev.filter((a) => a.id !== newAlbum.id)]);
    setSelectedAlbum(newAlbum);
  };

  // Handle complete form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedArtist) {
      toast.error('Please select or create an artist');
      return;
    }

    if (!selectedAlbum) {
      toast.error('Please select or create an album');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a track title');
      return;
    }

    if (!originalAudioFile) {
      toast.error('Please upload an audio file (.mp3, .opus, etc.)');
      return;
    }

    try {
      setIsUploading(true);

      const isUsingProcessed = selectedVersion === 'processed' && processedAudioBase64;

      toast.loading(
        isUsingProcessed
          ? 'Uploading normalized & trimmed audio to Supabase...'
          : 'Uploading audio to Supabase...',
        { id: 'upload-song' }
      );

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('album_id', selectedAlbum.id);
      formData.append('artist_name', selectedArtist.name);
      formData.append('duration_seconds', String(durationSeconds || 180));
      formData.append('language', language);
      formData.append('tags', tags);
      formData.append('narration_text', narrationText.trim());

      if (isUsingProcessed && processedAudioBase64) {
        // Convert the previewed processed buffer into File and send directly
        const fileToUpload = base64ToFile(
          processedAudioBase64,
          originalAudioFile.name,
          originalAudioFile.type || 'audio/mpeg'
        );
        formData.append('audio', fileToUpload);
        formData.append('already_processed', 'true');
      } else {
        // Send original audio file
        formData.append('audio', originalAudioFile);
        formData.append('already_processed', 'false');
        formData.append('normalize_audio', String(normalizeAudio));
        formData.append('trim_silence', String(trimSilence));
      }

      const res = await uploadSong(formData);

      if (!res.success || !res.song) {
        throw new Error(res.error || 'Failed to upload song');
      }

      toast.success(`Track "${res.song.title}" saved to library!`, { id: 'upload-song' });

      setUploadedSongData({
        id: res.song.id,
        title: res.song.title,
        albumId: selectedAlbum.id,
        artistId: selectedArtist.id,
        artistName: selectedArtist.name,
        albumTitle: selectedAlbum.title,
      });

      // Clear audio fields for next song
      setOriginalAudioFile(null);
      if (originalAudioUrl) {
        URL.revokeObjectURL(originalAudioUrl);
        setOriginalAudioUrl(null);
      }
      setProcessedAudioBase64(null);
      setProcessedDuration(null);
      setTrimmedSeconds(0);
      setTitle('');
      setDurationSeconds(0);
      setTags('');
      setNarrationText('');
    } catch (err: any) {
      console.error('[UploadSongPage] Error:', err);
      toast.error(err?.message || 'Upload failed. Please check network and file.', { id: 'upload-song' });
    } finally {
      setIsUploading(false);
    }
  };

  // Reset form
  const handleResetAll = () => {
    setSelectedArtist(null);
    setSelectedAlbum(null);
    setTitle('');
    if (originalAudioUrl) {
      URL.revokeObjectURL(originalAudioUrl);
      setOriginalAudioUrl(null);
    }
    setOriginalAudioFile(null);
    setProcessedAudioBase64(null);
    setProcessedDuration(null);
    setTrimmedSeconds(0);
    setDurationSeconds(0);
    setTags('');
    setNarrationText('');
    setUploadedSongData(null);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-neutral-900 via-neutral-950 to-black text-white p-4 md:p-8 flex flex-col items-center">
      {/* Container */}
      <div className="w-full max-w-4xl flex flex-col gap-y-6">
        
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/40 via-neutral-900 to-indigo-950/40 border border-purple-500/20 p-6 md:p-8 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-x-4">
              <div className="w-13 h-13 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-inner">
                <HiCloudArrowUp className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                    Music Uploader
                  </h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full">
                    Admin Studio
                  </span>
                </div>
                <p className="text-xs md:text-sm text-neutral-400 mt-1">
                  Upload lossless or high-efficiency audio (<span className="text-purple-300 font-mono">.mp3</span>, <span className="text-purple-300 font-mono">.opus</span>, <span className="text-purple-300 font-mono">.m4a</span>), auto-normalize loudness & trim trailing silence with live A/B preview.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="text-xs font-semibold px-3 py-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition border border-neutral-700"
              >
                Back to Player
              </Link>
            </div>
          </div>
        </div>

        {/* Upload Success Alert */}
        {uploadedSongData && (
          <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/30 p-5 md:p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <HiCheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Track Saved & Uploaded to Supabase
                </p>
                <h3 className="text-base font-bold text-white mt-0.5">
                  &ldquo;{uploadedSongData.title}&rdquo; <span className="text-neutral-400 font-normal">by</span> {uploadedSongData.artistName}
                </h3>
                <p className="text-xs text-neutral-400">
                  Album: <span className="text-neutral-200">{uploadedSongData.albumTitle}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
              <Link
                href={`/album/${uploadedSongData.albumId}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
              >
                View Album <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
              </Link>
              <Link
                href={`/artist/${uploadedSongData.artistId}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition cursor-pointer"
              >
                View Artist <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setUploadedSongData(null)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Main Upload Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-6">
          
          {/* Card 1: Artist & Album Selection */}
          <div className="relative z-30 rounded-2xl bg-neutral-900/70 border border-neutral-800 p-6 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-500/30">
                  1
                </span>
                <h2 className="text-base font-semibold text-white">Artist & Album</h2>
              </div>
              {selectedArtist && (
                <span className="text-xs text-neutral-400">
                  Albums available: <strong className="text-neutral-200">{albums.length}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <ArtistSelector
                artists={artists}
                selectedArtist={selectedArtist}
                onSelectArtist={(artist) => {
                  setSelectedArtist(artist);
                  setSelectedAlbum(null);
                }}
                onOpenNewArtistModal={() => setIsArtistModalOpen(true)}
              />

              <AlbumSelector
                albums={albums}
                selectedAlbum={selectedAlbum}
                artistSelected={Boolean(selectedArtist)}
                onSelectAlbum={(album) => setSelectedAlbum(album)}
                onOpenNewAlbumModal={() => {
                  if (!selectedArtist) {
                    toast.error('Please select an artist first before creating an album');
                    return;
                  }
                  setIsAlbumModalOpen(true);
                }}
                isLoadingAlbums={isLoadingAlbums}
              />
            </div>
          </div>

          {/* Card 2: Audio File Upload & Processing / A-B Preview */}
          <div className="relative z-10 rounded-2xl bg-neutral-900/70 border border-neutral-800 p-6 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-500/30">
                  2
                </span>
                <h2 className="text-base font-semibold text-white">Audio Track & Processing</h2>
              </div>
              <span className="text-xs text-neutral-400 font-mono">
                Supports .mp3, .opus, .m4a, .wav, .flac
              </span>
            </div>

            {/* Drag & Drop Audio Upload Zone */}
            <AudioUploadZone
              selectedFile={originalAudioFile}
              durationSeconds={originalDuration}
              onAudioSelected={handleAudioSelected}
            />

            {/* Audio Processing Switches */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Normalization switch */}
              <div 
                onClick={() => setNormalizeAudio(!normalizeAudio)}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700 cursor-pointer select-none transition"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                    normalizeAudio 
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' 
                      : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                  }`}>
                    <HiSpeakerWave className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white">Normalize Volume</span>
                      <span className="text-[9px] font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 py-0.2 rounded">
                        -14 LUFS
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                      Tones down blasting tracks & raises quiet audio safely.
                    </p>
                  </div>
                </div>

                <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out mt-0.5 ${
                  normalizeAudio ? 'bg-purple-600' : 'bg-neutral-700'
                }`}>
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      normalizeAudio ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Trailing Silence Trim switch */}
              <div 
                onClick={() => setTrimSilence(!trimSilence)}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700 cursor-pointer select-none transition"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                    trimSilence 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                      : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                  }`}>
                    <HiScissors className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white">Trim End Silence</span>
                      <span className="text-[9px] font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 py-0.2 rounded">
                        Autocut
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                      Cuts 5-10s of dead silence at the end of tracks.
                    </p>
                  </div>
                </div>

                <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out mt-0.5 ${
                  trimSilence ? 'bg-emerald-600' : 'bg-neutral-700'
                }`}>
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      trimSilence ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Process & Preview Action Button */}
            {originalAudioFile && (
              <div className="flex flex-col gap-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleProcessAudio}
                  disabled={isProcessingAudio}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-600 hover:to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-900/30 transition cursor-pointer disabled:opacity-50"
                >
                  {isProcessingAudio ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing Audio, Normalizing & Trimming End Silence...
                    </>
                  ) : (
                    <>
                      <HiBolt className="w-4 h-4 text-yellow-300" />
                      {processedAudioBase64 ? 'Re-Process Audio & Update Preview' : 'Process & Generate A/B Audio Preview'}
                    </>
                  )}
                </button>

                {/* A/B Audio Comparison Card */}
                {processedAudioBase64 && (
                  <div className="rounded-xl bg-neutral-950/90 border border-neutral-800 p-4 flex flex-col gap-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                          A/B Audio Comparison
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          (Listen to verify volume & ending cut before saving)
                        </span>
                      </div>
                      {trimmedSeconds > 0 && (
                        <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                          ✂️ {trimmedSeconds}s trailing silence removed
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Original Track Preview */}
                      <div 
                        onClick={() => {
                          setSelectedVersion('original');
                          setDurationSeconds(originalDuration);
                        }}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col gap-y-2 ${
                          selectedVersion === 'original'
                            ? 'bg-neutral-900 border-purple-500 shadow-lg shadow-purple-500/10'
                            : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              selectedVersion === 'original'
                                ? 'border-purple-400 bg-purple-600'
                                : 'border-neutral-600'
                            }`}>
                              {selectedVersion === 'original' && <HiCheck className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs font-bold text-neutral-200">
                              A: Original Audio
                            </span>
                          </div>
                          <span className="text-xs font-mono text-neutral-400">
                            {formatTime(originalDuration)}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          Raw volume, unmodified ending.
                        </p>
                        {originalAudioUrl && (
                          <audio
                            controls
                            src={originalAudioUrl}
                            preload="metadata"
                            className="w-full h-8 mt-1 filter invert hue-rotate-180 brightness-90 contrast-125"
                          />
                        )}
                        <span className="text-[10px] text-neutral-500 mt-1">
                          {selectedVersion === 'original' ? '● Selected for upload' : 'Click to select this version'}
                        </span>
                      </div>

                      {/* Processed Track Preview */}
                      <div 
                        onClick={() => {
                          setSelectedVersion('processed');
                          if (processedDuration) setDurationSeconds(processedDuration);
                        }}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col gap-y-2 ${
                          selectedVersion === 'processed'
                            ? 'bg-purple-950/20 border-purple-500 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/50'
                            : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              selectedVersion === 'processed'
                                ? 'border-purple-400 bg-purple-600'
                                : 'border-neutral-600'
                            }`}>
                              {selectedVersion === 'processed' && <HiCheck className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                              B: Modified Audio (Recommended)
                            </span>
                          </div>
                          <span className="text-xs font-mono text-purple-300 font-semibold">
                            {formatTime(processedDuration || originalDuration)}
                          </span>
                        </div>
                        <p className="text-[11px] text-purple-300/80">
                          Normalized to Spotify -14 LUFS • End silence cleanly cut.
                        </p>
                        <audio
                          controls
                          src={processedAudioBase64}
                          preload="metadata"
                          className="w-full h-8 mt-1 filter invert hue-rotate-180 brightness-90 contrast-125"
                        />
                        <span className="text-[10px] text-purple-400 font-semibold mt-1">
                          {selectedVersion === 'processed' ? '✓ Will be uploaded to Supabase & Database' : 'Click to select this version'}
                        </span>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Track Metadata & Narration */}
          <div className="relative z-0 rounded-2xl bg-neutral-900/70 border border-neutral-800 p-6 md:p-7 backdrop-blur-md shadow-xl flex flex-col gap-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-500/30">
                  3
                </span>
                <h2 className="text-base font-semibold text-white">Track Metadata</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Track Title */}
              <div className="flex flex-col gap-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-neutral-300">
                  Track Title <span className="text-purple-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <HiMusicalNote className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Bohemian Rhapsody, Kesariya, Blinding Lights..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              </div>

              {/* Duration (Seconds) */}
              <div className="flex flex-col gap-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300">
                    Duration (Seconds)
                  </label>
                  {durationSeconds > 0 && (
                    <span className="text-[11px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                      {formatTime(durationSeconds)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <HiClock className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={durationSeconds || ''}
                    onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10) || 0)}
                    placeholder="Auto-detected from file"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              </div>

              {/* Language */}
              <div className="flex flex-col gap-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">
                  Language
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <HiLanguage className="w-4 h-4" />
                  </div>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition cursor-pointer appearance-none"
                  >
                    {COMMON_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang} className="bg-neutral-900 text-white">
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-col gap-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-neutral-300">
                  Tags <span className="text-[11px] font-normal text-neutral-500">(comma-separated)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                    <HiTag className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="e.g. pop, energetic, female vocals, synthwave, 80s"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              </div>

              {/* Narration Text (for Edge Neural TTS) */}
              <div className="flex flex-col gap-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <HiSparkles className="w-3.5 h-3.5 text-purple-400" />
                    AI DJ Intro / Narration Text
                    <span className="text-[10px] uppercase font-normal text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30">
                      Edge Neural TTS
                    </span>
                  </label>
                </div>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={narrationText}
                    onChange={(e) => setNarrationText(e.target.value)}
                    placeholder="Optional voice announcer script before the song plays, e.g.: 'Here is a chart-topping hit from Arijit Singh off the album Brahmāstra...'"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 pb-12">
            <button
              type="button"
              onClick={handleResetAll}
              disabled={isUploading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-semibold transition border border-neutral-700/80 cursor-pointer disabled:opacity-50"
            >
              <HiArrowPath className="w-4 h-4" /> Reset All Fields
            </button>

            <button
              type="submit"
              disabled={isUploading || !selectedArtist || !selectedAlbum || !originalAudioFile || !title.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-purple-600/25 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading & Storing in Supabase...
                </>
              ) : (
                <>
                  <HiCloudArrowUp className="w-5 h-5" />
                  Upload Track to Library {selectedVersion === 'processed' && processedAudioBase64 ? '(Modified)' : ''}
                </>
              )}
            </button>
          </div>
        </form>

      </div>

      {/* New Artist Modal */}
      <NewArtistModal
        isOpen={isArtistModalOpen}
        onClose={() => setIsArtistModalOpen(false)}
        onArtistCreated={handleArtistCreated}
      />

      {/* New Album Modal */}
      {selectedArtist && (
        <NewAlbumModal
          isOpen={isAlbumModalOpen}
          onClose={() => setIsAlbumModalOpen(false)}
          artistId={selectedArtist.id}
          artistName={selectedArtist.name}
          onAlbumCreated={handleAlbumCreated}
        />
      )}
    </div>
  );
}
