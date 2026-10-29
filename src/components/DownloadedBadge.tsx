'use client';

import React from 'react';
import { BsCheckCircleFill } from 'react-icons/bs';
import useDownloadStore from '@/stores/useDownloadStore';

interface DownloadedBadgeProps {
  songId: string;
  size?: number;
  className?: string;
}

const DownloadedBadge: React.FC<DownloadedBadgeProps> = ({ songId, size = 12, className = '' }) => {
  const isDownloaded = useDownloadStore((state) => state.downloadedSongIds.has(songId));

  if (!isDownloaded) return null;

  return (
    <span 
      title="Downloaded for offline playback"
      className={`inline-flex items-center justify-center flex-shrink-0 text-emerald-500 cursor-default select-none ${className}`}
    >
      <BsCheckCircleFill size={size} />
    </span>
  );
};

export default DownloadedBadge;

