'use client';

import React, { useRef, useState } from 'react';
import { HiMusicalNote, HiTrash, HiCheckCircle } from 'react-icons/hi2';
import { toast } from 'react-hot-toast';

interface AudioUploadZoneProps {
  onAudioSelected: (file: File | null, durationSeconds: number) => void;
  selectedFile: File | null;
  durationSeconds: number;
}

export const AudioUploadZone: React.FC<AudioUploadZoneProps> = ({
  onAudioSelected,
  selectedFile,
  durationSeconds,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const handleProcessAudio = (file: File) => {
    // Check file extension / mime type
    const validExts = ['mp3', 'opus', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'webm'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (!validExts.includes(ext) && !file.type.startsWith('audio/')) {
      toast.error('Please upload a valid audio file (.mp3, .opus, .m4a, .wav, .ogg, .flac)');
      return;
    }

    // Auto extract duration
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.src = objectUrl;

    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration || 0);
      URL.revokeObjectURL(objectUrl);
      onAudioSelected(file, duration);
      toast.success(`Audio loaded (${formatTime(duration)})`);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback with duration 0 (user can manually adjust)
      onAudioSelected(file, 0);
      toast('Audio loaded (could not auto-detect duration)', { icon: 'ℹ️' });
    };
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessAudio(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClear = () => {
    onAudioSelected(null, 0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-y-1.5 w-full">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-neutral-300">
          Audio File (.mp3, .opus, .m4a, .wav, .ogg, .flac) <span className="text-purple-400">*</span>
        </label>
        {selectedFile && durationSeconds > 0 && (
          <span className="text-xs font-mono text-purple-400 font-semibold">
            Duration: {formatTime(durationSeconds)} ({durationSeconds}s)
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.opus,.m4a,.wav,.ogg,.flac"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleProcessAudio(file);
        }}
        className="hidden"
        id="audio-file-input"
      />

      {selectedFile ? (
        <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-x-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <HiMusicalNote className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-x-2">
                <span className="text-sm font-semibold text-white truncate">
                  {selectedFile.name}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 shrink-0">
                  {selectedFile.name.split('.').pop()}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {formatTime(durationSeconds)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-x-2 shrink-0">
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <HiCheckCircle className="w-4 h-4" /> Ready
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-neutral-400 hover:text-red-400 transition rounded-lg hover:bg-neutral-800 cursor-pointer ml-2"
              title="Remove audio file"
            >
              <HiTrash className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-y-2 ${
            isDragging
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/40 hover:bg-neutral-900/70'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-1">
            <HiMusicalNote className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Drag and drop your audio file here, or <span className="text-purple-400 hover:underline">browse</span>
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Supports MP3, OPUS, M4A, WAV, OGG, FLAC (duration is automatically detected)
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

