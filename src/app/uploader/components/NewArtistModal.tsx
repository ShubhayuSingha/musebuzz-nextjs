'use client';

import React, { useState } from 'react';
import { HiXMark, HiUserPlus } from 'react-icons/hi2';
import { toast } from 'react-hot-toast';
import { ImageInput } from './ImageInput';
import { createArtist } from '../actions';

interface NewArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onArtistCreated: (artist: { id: string; name: string; image_path: string | null }) => void;
}

export const NewArtistModal: React.FC<NewArtistModalProps> = ({
  isOpen,
  onClose,
  onArtistCreated,
}) => {
  const [name, setName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Artist name is required');
      return;
    }

    try {
      setIsLoading(true);
      toast.loading('Creating new artist...', { id: 'create-artist' });

      const formData = new FormData();
      formData.append('name', trimmedName);
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const res = await createArtist(formData);
      if (!res.success || !res.artist) {
        throw new Error(res.error || 'Failed to create artist');
      }

      toast.success(`Artist "${res.artist.name}" created!`, { id: 'create-artist' });
      onArtistCreated(res.artist);
      setName('');
      setImageFile(null);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Error creating artist', { id: 'create-artist' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <HiUserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Create New Artist</h3>
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
              Artist Name <span className="text-purple-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coldplay, Pritam, A. R. Rahman..."
              disabled={isLoading}
              required
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-purple-500 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none transition"
            />
          </div>

          {/* Artist Photo */}
          <ImageInput
            label="Artist Photo (Optional)"
            sublabel="Paste image link or upload (auto-cropped to circular 1:1)"
            isCircular={true}
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
              disabled={isLoading || !name.trim()}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition shadow-lg shadow-purple-900/30 cursor-pointer"
            >
              {isLoading ? 'Saving...' : 'Save Artist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

