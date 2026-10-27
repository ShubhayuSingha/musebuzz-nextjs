'use client';

import Link from 'next/link';
import { HiSignalSlash, HiArrowPath, HiMusicalNote } from 'react-icons/hi2';
import StorageIndicator from '@/components/StorageIndicator';

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mb-6 shadow-xl shadow-black/40">
        <HiSignalSlash className="w-10 h-10 text-emerald-400" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
        You are offline
      </h1>

      <p className="text-zinc-400 max-w-md text-sm md:text-base mb-8 leading-relaxed">
        You seem to have lost your internet connection. Any playlists and albums you have downloaded are available to play in your library.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 mb-8">
        <Link
          href="/library"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-transform active:scale-95 shadow-lg shadow-emerald-500/20"
        >
          <HiMusicalNote className="w-5 h-5" />
          Go to Library
        </Link>

        <button
          onClick={() => window.location.reload()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm transition-transform active:scale-95 border border-zinc-700"
        >
          <HiArrowPath className="w-4 h-4" />
          Retry Connection
        </button>
      </div>

      <div className="w-full max-w-xs">
        <StorageIndicator />
      </div>
    </div>
  );
}
