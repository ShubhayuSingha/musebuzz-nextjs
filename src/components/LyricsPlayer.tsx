'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import usePlayerStore from '@/stores/usePlayerStore';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

export interface LyricLine {
  type?: "lyrics" | "music";
  text: string;
  start: number | null;
  end: number | null;
}

export default function LyricsPlayer() {
  const { activeId, setSeekRequest } = usePlayerStore();
  
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const activeLineIndexRef = useRef(-1);

  const [isAutoSyncing, setIsAutoSyncing] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Tracks if the computer is scrolling so we can ignore the onScroll event
  const isProgrammaticScrollRef = useRef(false);

  // 1. DATABASE FETCHING & INSTANT JUMP ON MOUNT
  useEffect(() => {
    if (!activeId) { setLyrics([]); return; }
    
    const fetchLyrics = async () => {
      setIsLoading(true);
      const { data } = await supabase.from('songs').select('lyrics_snippet').eq('id', activeId).single();
      
      if (data?.lyrics_snippet) {
        try { 
          const parsedLyrics = JSON.parse(data.lyrics_snippet);
          setLyrics(parsedLyrics); 

          // Find the exact line the song is currently on
          const initialTime = (window as any).__musebuzzCurrentTime || 0;
          const initialIndex = parsedLyrics.findIndex((line: LyricLine) => {
              if (line.start === null) return false;
              const endTime = line.end !== null ? line.end : line.start + 5;
              return initialTime >= line.start && initialTime < endTime;
          });
          
          if (initialIndex !== -1) {
              activeLineIndexRef.current = initialIndex;
              setActiveLineIndex(initialIndex);

              // 🟢 FORCE INSTANT JUMP
              // Wait 100ms for React to map the new text to the screen, then teleport exactly to the line
              setTimeout(() => {
                  const el = lineRefs.current[initialIndex];
                  const container = containerRef.current;
                  if (el && container) {
                      isProgrammaticScrollRef.current = true;
                      container.scrollTo({
                          top: el.offsetTop + (el.clientHeight / 2) - (container.clientHeight * 0.3),
                          behavior: 'auto' // 'auto' means instant jump!
                      });
                      setTimeout(() => { isProgrammaticScrollRef.current = false; }, 200);
                  }
              }, 100); 
          }

        } catch { setLyrics([]); }
      } else { setLyrics([]); }
      
      setIsLoading(false);
    };
    fetchLyrics();
  }, [activeId]);

  // 2. HIGH-PERFORMANCE TIME LISTENER
  useEffect(() => {
    const handleTimeUpdate = (e: any) => {
        const time = e.detail;
        
        const newIndex = lyrics.findIndex(line => {
            if (line.start === null) return false;
            const endTime = line.end !== null ? line.end : line.start + 5;
            return time >= line.start && time < endTime;
        });
        
        if (newIndex !== activeLineIndexRef.current && newIndex !== -1) {
            activeLineIndexRef.current = newIndex;
            setActiveLineIndex(newIndex); 
        }
    };
    window.addEventListener('lyrics-time-update', handleTimeUpdate);
    return () => window.removeEventListener('lyrics-time-update', handleTimeUpdate);
  }, [lyrics]);

  // 3. THE MATHEMATICAL AUTO-SCROLL (During normal playback)
  useEffect(() => {
    if (!isAutoSyncing || activeLineIndex === -1) return; 

    const activeEl = lineRefs.current[activeLineIndex];
    const container = containerRef.current;

    if (activeEl && container) {
      const scrollTimeout = setTimeout(() => {
        const offsetTarget = container.clientHeight * 0.4; 
        const elTop = activeEl.offsetTop;
        const elHalfHeight = activeEl.clientHeight / 2;
        
        // Lock the detector, scroll smoothly, then unlock
        isProgrammaticScrollRef.current = true;
        
        container.scrollTo({
          top: elTop + elHalfHeight - offsetTarget,
          behavior: 'smooth'
        });

        setTimeout(() => {
            isProgrammaticScrollRef.current = false;
        }, 600);

      }, 50);
      return () => clearTimeout(scrollTimeout);
    }
  }, [activeLineIndex, isAutoSyncing]);

  // 4. INSTANT MANUAL SCROLL DETECTION
  const handleUserInteraction = () => {
      if (!isProgrammaticScrollRef.current && isAutoSyncing) {
          setIsAutoSyncing(false);
      }
  };

  if (isLoading) {
    return <div className="h-full w-full flex items-center justify-center text-neutral-500">Loading...</div>;
  }
  
  if (!lyrics.length) {
    return <div className="h-full w-full flex items-center justify-center text-neutral-500">Looks like we don't have lyrics for this song yet.</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-transparent overflow-hidden relative">
      
      <div 
        ref={containerRef}
        onScroll={handleUserInteraction}
        className="flex-1 overflow-y-auto scrollbar-hide relative"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 2%, black 10%, black 90%, transparent 98%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 2%, black 10%, black 90%, transparent 98%)'
        }}
      >
        <div className="flex flex-col max-w-4xl mx-auto px-6 pt-12 pb-32 text-left items-start relative">
          
          <div className="flex flex-col w-full gap-6">
            {lyrics.map((line, lineIdx) => {
              const isActiveLine = activeLineIndex === lineIdx;
              const hasPassed = activeLineIndex !== -1 && lineIdx < activeLineIndex && line.start !== null;

              // 🟢 FIX: No more "Instrumental" logic. Just use the original text or dots for empty gaps.
              const displayText = line.text?.trim() || "• • •";

              let colorClass = "";
              if (isActiveLine) {
                colorClass = "text-purple-400 drop-shadow-[0_0_15px_rgba(192,132,252,0.4)]";
              } else if (hasPassed) {
                colorClass = "text-neutral-500 hover:text-neutral-400";
              } else {
                colorClass = "text-white hover:text-neutral-200";
              }

              return (
                <div
                  key={lineIdx}
                  ref={(el) => { lineRefs.current[lineIdx] = el; }}
                  className="flex w-full cursor-pointer justify-start"
                  onClick={() => {
                      if (line.start !== null) {
                          setSeekRequest(line.start);
                          setIsAutoSyncing(true);
                      }
                  }} 
                >
                  <span className={`text-2xl font-bold transition-colors duration-300 ${colorClass}`}>
                    {displayText}
                  </span>
                </div>
              );
            })}
          </div>
          
        </div>
      </div>

      {/* RESUME SYNC BUTTON */}
      <AnimatePresence>
        {!isAutoSyncing && (
          <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-[100px] right-6 z-[100]"
          >
              <button
                  onClick={() => {
                      setIsAutoSyncing(true);
                      const activeEl = lineRefs.current[activeLineIndexRef.current];
                      if (activeEl && containerRef.current) {
                          isProgrammaticScrollRef.current = true;
                          const offsetTarget = containerRef.current.clientHeight * 0.3;
                          containerRef.current.scrollTo({
                              top: activeEl.offsetTop + (activeEl.clientHeight / 2) - offsetTarget,
                              behavior: 'smooth'
                          });
                          setTimeout(() => { isProgrammaticScrollRef.current = false; }, 600);
                      }
                  }}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-full border border-neutral-700 shadow-xl text-sm font-bold flex items-center gap-2 transition"
              >
                  ↓ Resume Sync
              </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}