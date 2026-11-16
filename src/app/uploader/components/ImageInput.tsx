'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { HiPhoto, HiLink, HiTrash, HiArrowPath } from 'react-icons/hi2';
import { toast } from 'react-hot-toast';
import { processSquareImage } from './imageUtils';
import { fetchRemoteImageAsBase64 } from '../actions';

interface ImageInputProps {
  label: string;
  sublabel?: string;
  isCircular?: boolean;
  onImageProcessed: (file: File | null) => void;
}

export const ImageInput: React.FC<ImageInputProps> = ({
  label,
  sublabel = 'Paste image link or upload file (auto-cropped to Spotify 1:1)',
  isCircular = false,
  onImageProcessed,
}) => {
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle local file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selected file is not an image');
      return;
    }

    try {
      setIsProcessing(true);
      const { file: processed, dataUrl } = await processSquareImage(file);
      setPreviewUrl(dataUrl);
      onImageProcessed(processed);
      toast.success('Image auto-cropped to 1:1 square');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle remote URL fetch & crop
  const handleFetchUrl = async () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) {
      toast.error('Please enter a valid image URL');
      return;
    }

    try {
      setIsProcessing(true);
      toast.loading('Fetching and resizing image...', { id: 'fetch-img' });

      // Fetch on server to avoid CORS blocks
      const res = await fetchRemoteImageAsBase64(trimmed);
      if (!res.success || !res.base64) {
        throw new Error(res.error || 'Could not download image from URL');
      }

      // Auto crop and resize to 640x640 square
      const { file: processed, dataUrl } = await processSquareImage(res.base64);
      setPreviewUrl(dataUrl);
      onImageProcessed(processed);
      setImageUrlInput('');
      toast.success('Image downloaded & cropped to 1:1', { id: 'fetch-img' });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to fetch image from URL', { id: 'fetch-img' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setPreviewUrl(null);
    setImageUrlInput('');
    onImageProcessed(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-col">
        <label className="text-sm font-semibold text-neutral-200">{label}</label>
        {sublabel && <p className="text-xs text-neutral-400">{sublabel}</p>}
      </div>

      {previewUrl ? (
        <div className="relative flex items-center gap-x-4 bg-neutral-900/80 p-3 rounded-xl border border-neutral-800">
          <div
            className={`relative w-24 h-24 shrink-0 overflow-hidden bg-neutral-800 border border-neutral-700 shadow-md ${
              isCircular ? 'rounded-full' : 'rounded-lg'
            }`}
          >
            <Image
              src={previewUrl}
              alt="Processed Cover"
              fill
              className="object-cover"
              unoptimized
            />
          </div>

          <div className="flex flex-col gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full w-fit">
              ✓ 640×640 1:1 Optimized
            </span>
            <p className="text-neutral-400">Ready for upload to Supabase</p>

            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 mt-2 transition text-xs font-medium cursor-pointer w-fit"
            >
              <HiTrash className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-y-2.5">
          {/* Paste Image URL Bar */}
          <div className="flex items-center gap-x-2">
            <div className="relative flex-1">
              <HiLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFetchUrl();
                  }
                }}
                placeholder="Paste image link (e.g. from Wikipedia, Spotify, Google)..."
                disabled={isProcessing}
                className="w-full bg-neutral-900 border border-neutral-800 focus:border-purple-500 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 outline-none transition"
              />
            </div>
            <button
              type="button"
              onClick={handleFetchUrl}
              disabled={isProcessing || !imageUrlInput.trim()}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {isProcessing ? (
                <HiArrowPath className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Fetch'
              )}
            </button>
          </div>

          {/* Or File Upload Button */}
          <div className="flex items-center gap-x-3">
            <div className="h-[1px] bg-neutral-800/80 flex-1" />
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">or upload</span>
            <div className="h-[1px] bg-neutral-800/80 flex-1" />
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="hidden"
              id={`file-input-${label.replace(/\s+/g, '-')}`}
            />
            <label
              htmlFor={`file-input-${label.replace(/\s+/g, '-')}`}
              className="w-full border border-dashed border-neutral-700 hover:border-purple-500/70 bg-neutral-900/40 hover:bg-neutral-900/70 p-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition text-xs text-neutral-300"
            >
              <HiPhoto className="w-4 h-4 text-purple-400" />
              <span>Choose local image file...</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

