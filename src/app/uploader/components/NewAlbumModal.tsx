'use client';

import React, { useState } from 'react';
import { HiXMark, HiFolderPlus } from 'react-icons/hi2';
import { toast } from 'react-hot-toast';
import { ImageInput } from './ImageInput';
import { createAlbum } from '../actions';

interface NewAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistId: string;
  artistName: string;
  onAlbumCreated: (album: { id: string; title: string; image_path: string | null; genre: string | null; release_type: string }) => void;
}

const COMMON_GENRES = [
  'Pop',
  'Rock',
  'Bollywood',
  'Classical',
  'Hip-Hop',
  'R&B',
  'Indie',
  'Electronic / EDM',
  'Acoustic / Folk',
  'Jazz',
  'Lo-Fi',
  'Metal',
  'Other',
];

export const NewAlbumModal: React.FC<NewAlbumModalProps> = ({
  isOpen,
  onClose,
  artistId,
  artistName,
  onAlbumCreated,
}) => {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [releaseType, setReleaseType] = useState('album');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Album title is required');
      return;
    }
    if (!artistId) {
      toast.error('Artist is not selected');
      return;
    }

    try {
      setIsLoading(true);
      toast.loading('Creating new album...', { id: 'create-album' });

      const formData = new FormData();
      formData.append('title', trimmedTitle);
      formData.append('artist_id', artistId);
      formData.append('genre', genre);
      formData.append('release_type', releaseType);
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const res = await createAlbum(formData);
      if (!res.success || !res.album) {
        throw new Error(res.error || 'Failed to create album');
      }

      toast.success(`Album "${res.album.title}" created!`, { id: 'create-album' });
      onAlbumCreated(res.album);
      setTitle('');
      setImageFile(null);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Error creating album', { id: 'create-album' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <HiFolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create New Album</h3>
              <p className="text-xs text-neutral-400">Under: <span className="text-purple-400 font-semibold">{artistName}</span></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Album Title <span className="text-purple-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Parachutes, Aashiqui 2, After Hours..."
              disabled={isLoading}
              required
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-purple-500 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Release Type</label>
              <select
                value={releaseType}
                onChange={(e) => setReleaseType(e.target.value)}
                disabled={isLoading}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition"
              >
                <option value="album">Album</option>
                <option value="single">Single</option>
                <option value="ep">EP</option>
                <option value="compilation">Compilation</option>
              </select>
            </div>

            <div className="flex flex-col gap-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                disabled={isLoading}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition"
              >
                {COMMON_GENRES.map((g) => (
                  <option key={g} value={g.toLowerCase()}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Album Cover */}
          <ImageInput
            label="Album Cover Artwork (Optional)"
            sublabel="Paste image link or upload (auto-cropped to Spotify 640×640 1:1)"
            isCircular={false}
            onImageProcessed={setImageFile}
          />

          <div className="flex items-center justify-end gap-x-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !title.trim()}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-purple-900/30 cursor-pointer"
            >
              {isLoading ? 'Saving...' : 'Save Album'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

