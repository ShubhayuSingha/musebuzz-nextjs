'use client';

import React from 'react';
import { LuMusic, LuShuffle, LuRepeat, LuMic, LuListMusic } from 'react-icons/lu';
import { IoPlay, IoPlaySkipBack, IoPlaySkipForward } from 'react-icons/io5';
import { HiSpeakerWave, HiSpeakerXMark } from 'react-icons/hi2';
import Slider from 'rc-slider';
import usePlayerStore from '@/stores/usePlayerStore';
import useQueueStore from '@/stores/useQueueStore';

const IdlePlayer: React.FC = () => {
  const { volume, setVolume, prevVolume, setPrevVolume } = usePlayerStore();
  const { isOpen, activeView, toggle } = useQueueStore();

  const toggleMute = () => {
    if (volume === 0) setVolume(prevVolume || 1);
    else {
      setPrevVolume(volume);
      setVolume(0);
    }
  };

  const VolumeIcon = volume === 0 ? HiSpeakerXMark : HiSpeakerWave;

  return (
    <div className="hidden md:grid w-full pt-1.5 pb-2.5 h-[80px] px-4 border-t border-neutral-800 grid-cols-3 z-50 bg-black shrink-0 select-none">
      {/* Track Info Placeholder */}
      <div className="flex w-full justify-start items-center gap-x-4 overflow-hidden">
        <div className="relative h-14 w-14 rounded-md bg-neutral-900 border border-neutral-800/80 flex items-center justify-center flex-shrink-0 text-neutral-600">
          <LuMusic size={22} className="opacity-50" />
        </div>
        <div className="flex flex-col overflow-hidden max-w-[200px] xl:max-w-[250px]">
          <p className="text-neutral-400 font-medium text-sm truncate">No track playing</p>
          <p className="text-neutral-600 text-xs truncate">Select a song to play</p>
        </div>
      </div>

      {/* Center Controls Placeholder */}
      <div className="flex flex-col items-center justify-center gap-y-1 w-full max-w-[722px] mx-auto">
        <div className="flex items-center gap-x-4">
          <button
            type="button"
            disabled
            aria-label="Shuffle"
            className="flex items-center justify-center w-12 h-7.5 rounded-full text-neutral-700 cursor-not-allowed opacity-40 border border-transparent"
          >
            <LuShuffle size={16} />
          </button>

          <button
            type="button"
            disabled
            aria-label="Previous"
            className="flex items-center justify-center w-8.5 h-8.5 rounded-full text-neutral-700 cursor-not-allowed opacity-40"
          >
            <IoPlaySkipBack size={19} />
          </button>

          <button
            type="button"
            disabled
            aria-label="Play"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed"
          >
            <IoPlay size={18} className="ml-0.5" />
          </button>

          <button
            type="button"
            disabled
            aria-label="Next"
            className="flex items-center justify-center w-8.5 h-8.5 rounded-full text-neutral-700 cursor-not-allowed opacity-40"
          >
            <IoPlaySkipForward size={19} />
          </button>

          <button
            type="button"
            disabled
            aria-label="Repeat"
            className="flex items-center justify-center w-12 h-7.5 rounded-full text-neutral-700 cursor-not-allowed opacity-40 border border-transparent"
          >
            <LuRepeat size={16} />
          </button>
        </div>

        {/* Seekbar Placeholder */}
        <div className="flex items-center gap-x-3 w-full px-2">
          <p className="text-neutral-600 font-medium text-[12px] w-10 text-right tabular-nums">0:00</p>
          <div className="relative flex-1 py-1 flex items-center">
            <div className="w-full h-1 bg-neutral-800/80 rounded-full" />
          </div>
          <p className="text-neutral-600 font-medium text-[12px] w-10 text-left tabular-nums">0:00</p>
        </div>
      </div>

      {/* Right Controls: Volume + Queue/Lyrics */}
      <div className="flex w-full justify-end items-center pr-2 gap-x-3">
        {/* Lyrics Button */}
        <button
          type="button"
          onClick={() => toggle('lyrics')}
          title={activeView === 'lyrics' && isOpen ? "Hide Lyrics" : "Show Lyrics"}
          aria-label="Toggle Lyrics"
          className={`flex items-center justify-center w-12 h-7.5 rounded-full transition-all duration-200 active:scale-95 cursor-pointer ${
            activeView === 'lyrics' && isOpen
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.35)] backdrop-blur-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <LuMic size={16} />
        </button>

        {/* Queue Button (interactive so user can inspect queue even when idle) */}
        <button
          type="button"
          onClick={() => toggle('queue')}
          title={activeView === 'queue' && isOpen ? "Hide Queue" : "Show Queue"}
          aria-label="Toggle Queue"
          className={`flex items-center justify-center w-12 h-7.5 rounded-full transition-all duration-200 active:scale-95 cursor-pointer ${
            activeView === 'queue' && isOpen
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.35)] backdrop-blur-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <LuListMusic size={17} />
        </button>

        {/* Volume Controls (interactive so user can pre-adjust volume) */}
        <div className="flex items-center gap-x-2 w-36">
          <button
            type="button"
            onClick={toggleMute}
            aria-label="Toggle mute"
            className="cursor-pointer text-neutral-400 hover:text-white transition flex-shrink-0"
          >
            <VolumeIcon size={20} />
          </button>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(value) => setVolume(value as number)}
            styles={{
              track: { backgroundColor: '#a855f7' },
              handle: { backgroundColor: '#fff', border: 'none', boxShadow: 'none' },
              rail: { backgroundColor: 'rgb(63 63 70)' }
            }}
            className="!cursor-pointer [&_.rc-slider-handle]:!cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

export default IdlePlayer;

