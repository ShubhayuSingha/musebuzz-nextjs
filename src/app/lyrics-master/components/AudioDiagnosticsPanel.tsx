// src/app/lyrics-master/components/AudioDiagnosticsPanel.tsx

'use client';

import React, { useRef, useState, useEffect } from 'react';
import { UnifiedLyrics } from '../types/lyricsMaster.types';
import { formatMsToClock, formatSecondsToTime } from '../utils/timestampParser';
import { 
  FaPlay, 
  FaPause, 
  FaStop, 
  FaVolumeUp, 
  FaVolumeMute, 
  FaTachometerAlt, 
  FaMicrophone, 
  FaExclamationTriangle, 
  FaCheckCircle 
} from 'react-icons/fa';

interface AudioDiagnosticsPanelProps {
  audioUrl: string | null;
  songTitle: string;
  songDurationSeconds?: number;
  lyrics: UnifiedLyrics | null;
  currentTimeMs: number;
  onTimeUpdate: (ms: number) => void;
  seekRequestMs: number | null;
  onSeekHandled: () => void;
}

export const AudioDiagnosticsPanel: React.FC<AudioDiagnosticsPanelProps> = ({
  audioUrl,
  songTitle,
  songDurationSeconds,
  lyrics,
  currentTimeMs,
  onTimeUpdate,
  seekRequestMs,
  onSeekHandled,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(songDurationSeconds || 0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Handle external seek requests (e.g. clicking on a lyric timestamp)
  useEffect(() => {
    if (seekRequestMs !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequestMs / 1000;
      onTimeUpdate(seekRequestMs);
      onSeekHandled();
    }
  }, [seekRequestMs, onTimeUpdate, onSeekHandled]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDurationSec(audio.duration || songDurationSeconds || 0);
      setAudioError(null);
    };

    const handleTimeUpdateInternal = () => {
      const ms = Math.round(audio.currentTime * 1000);
      onTimeUpdate(ms);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      setAudioError('Failed to load audio from Supabase storage. Verify storage key and bucket permissions.');
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdateInternal);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdateInternal);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, songDurationSeconds, onTimeUpdate]);

  // Update volume & playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, isMuted, playbackRate]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        setAudioError(`Playback error: ${err.message}`);
        setIsPlaying(false);
      });
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      onTimeUpdate(0);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      onTimeUpdate(Math.round(val * 1000));
    }
  };

  // Find active line & segment
  const activeLine = lyrics?.lines.find(
    (l) => currentTimeMs >= l.startMs && currentTimeMs <= l.endMs
  );

  const activeSegment = activeLine?.segments?.find(
    (s) => currentTimeMs >= s.startMs && currentTimeMs <= s.endMs
  );

  // Drift diagnostic comparison
  const lastLyricEndSec = lyrics?.diagnostics.lastLineEndMs 
    ? lyrics.diagnostics.lastLineEndMs / 1000 
    : null;

  const audioDurationSec = durationSec || songDurationSeconds || 0;
  const driftSec = (lastLyricEndSec && audioDurationSec > 0)
    ? Math.abs(audioDurationSec - lastLyricEndSec)
    : null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FaMicrophone className="text-purple-400 text-lg" />
            Audio Sync & Timing Diagnostics Engine
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Testing synchronized lyrics for &quot;{songTitle}&quot; against the catalog recording
          </p>
        </div>

        {audioUrl ? (
          <span className="text-xs font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 self-start sm:self-auto">
            <FaCheckCircle className="text-[10px]" /> Local Audio Source Loaded
          </span>
        ) : (
          <span className="text-xs font-mono bg-amber-950/40 text-amber-400 border border-amber-800/60 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 self-start sm:self-auto">
            <FaExclamationTriangle className="text-[10px]" /> No Audio Path in DB
          </span>
        )}
      </div>

      {/* Hidden native audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      {audioError && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs mb-3 flex items-start gap-2">
          <FaExclamationTriangle className="shrink-0 mt-0.5" />
          <div>{audioError}</div>
        </div>
      )}

      {/* Main Player HUD */}
      <div className="bg-black/60 border border-neutral-800 rounded-xl p-4 mb-4">
        {/* Scrubber slider */}
        <div className="mb-3">
          <input
            type="range"
            min="0"
            max={durationSec || 100}
            step="0.05"
            value={currentTimeMs / 1000}
            onChange={handleSliderChange}
            disabled={!audioUrl}
            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-30"
          />
          <div className="flex justify-between items-center text-xs font-mono text-neutral-400 mt-1">
            <span className="text-purple-300 font-bold">{formatMsToClock(currentTimeMs)}</span>
            <span>{formatSecondsToTime(durationSec)}</span>
          </div>
        </div>

        {/* Playback Controls & Rate Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              disabled={!audioUrl}
              className="bg-purple-600 hover:bg-purple-500 text-white w-10 h-10 rounded-full flex items-center justify-center transition shadow-lg disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
            >
              {isPlaying ? <FaPause className="text-sm" /> : <FaPlay className="text-sm ml-0.5" />}
            </button>

            <button
              onClick={handleStop}
              disabled={!audioUrl}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 w-10 h-10 rounded-full flex items-center justify-center transition disabled:opacity-30"
            >
              <FaStop className="text-sm" />
            </button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-1 rounded-xl text-xs">
            <FaTachometerAlt className="text-neutral-500 ml-1.5 mr-0.5" />
            {[0.5, 0.75, 1.0, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                className={`px-2 py-1 rounded-lg font-mono font-bold transition ${
                  playbackRate === rate
                    ? 'bg-purple-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Volume control */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-neutral-400 hover:text-white text-sm"
            >
              {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-16 sm:w-24 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Real-time Firing Telemetry */}
      <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl mb-4">
        <div className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 mb-2 flex items-center justify-between">
          <span>Active Lyric Telemetry</span>
          <span className="font-mono text-purple-400">{formatMsToClock(currentTimeMs)}</span>
        </div>

        {activeLine ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                Line #{activeLine.lineIndex + 1}
              </span>
              <span className="text-xs font-mono text-neutral-400">
                Window: {formatMsToClock(activeLine.startMs)} &rarr; {formatMsToClock(activeLine.endMs)}
              </span>
            </div>

            <p className="text-lg font-bold text-white bg-black/40 p-2.5 rounded-lg border border-neutral-800/80">
              {activeLine.text}
            </p>

            {/* Active syllable/word badge */}
            {activeSegment ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-400">Active Syllable/Word:</span>
                <span className="bg-purple-600 text-white font-mono font-bold px-2.5 py-1 rounded-md text-sm shadow-[0_0_12px_rgba(168,85,247,0.5)]">
                  &quot;{activeSegment.text}&quot;
                </span>
                <span className="text-neutral-500 font-mono text-[11px]">
                  ({activeSegment.startMs}ms - {activeSegment.endMs}ms)
                </span>
              </div>
            ) : (
              <div className="text-xs text-neutral-500 italic">
                {activeLine.segments ? 'Between word syllables...' : 'Line-level timing active.'}
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-neutral-500 italic">
            {currentTimeMs === 0
              ? 'Press Play to inspect lyric firing synchronized to playback.'
              : 'Current playback position is in an instrumental or cue interval.'}
          </div>
        )}
      </div>

      {/* Drift & Synchronization Sanity Checks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* Intro Lead-in */}
        <div className="bg-black/40 border border-neutral-800 p-3 rounded-xl">
          <div className="text-neutral-500 font-semibold mb-1">Lead-in Duration</div>
          <div className="font-mono text-neutral-200 text-sm font-bold">
            {lyrics?.diagnostics.firstLineStartMs !== null && lyrics?.diagnostics.firstLineStartMs !== undefined
              ? `${(lyrics.diagnostics.firstLineStartMs / 1000).toFixed(2)}s`
              : 'N/A'}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Time before the first lyric line starts.
          </div>
        </div>

        {/* Last Lyric vs Audio End */}
        <div className="bg-black/40 border border-neutral-800 p-3 rounded-xl">
          <div className="text-neutral-500 font-semibold mb-1">Audio vs Lyric Drift</div>
          <div className={`font-mono text-sm font-bold ${
            driftSec && driftSec > 8 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {driftSec !== null ? `${driftSec.toFixed(2)}s delta` : 'N/A'}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Difference between audio file end & last lyric.
          </div>
        </div>

        {/* Monotonicity status */}
        <div className="bg-black/40 border border-neutral-800 p-3 rounded-xl">
          <div className="text-neutral-500 font-semibold mb-1">Timeline Monotonicity</div>
          <div className={`font-mono text-sm font-bold ${
            lyrics?.diagnostics.nonMonotonicTimestampsCount === 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {lyrics?.diagnostics.nonMonotonicTimestampsCount === 0
              ? '100% Monotonic'
              : `${lyrics?.diagnostics.nonMonotonicTimestampsCount} Non-sequential`}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Ensures timestamps only advance forward.
          </div>
        </div>
      </div>
    </div>
  );
};
