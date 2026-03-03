'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import usePlayerStore from '@/stores/usePlayerStore';
import useQueueStore from '@/stores/useQueueStore';
import { supabase } from '@/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

export interface LyricLine {
  type?: "lyrics" | "music";
  text?: string;                
  text_native?: string;         
  text_romanized?: string;      
  text_translation?: string;    
  start: number | null;
  end: number | null;
}

export default function LyricsPlayer() {
  const { activeId, setSeekRequest } = usePlayerStore();
  const { isOpen, activeView } = useQueueStore();
  
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const activeLineIndexRef = useRef(-1);

  const [isAutoSyncing, setIsAutoSyncing] = useState(true);

  const [scriptMode, setScriptMode] = useState<'native' | 'romanized'>('romanized');
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('musebuzz-script-mode');
      if (savedMode === 'native' || savedMode === 'romanized') setScriptMode(savedMode);
      
      const savedTrans = localStorage.getItem('musebuzz-show-translation');
      if (savedTrans !== null) setShowTranslation(savedTrans === 'true');
    }
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // 🟢 NEW: Centralized Lock Controller
  const isProgrammaticScrollRef = useRef(false);
  const unlockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hasNative = useMemo(() => lyrics.some(l => l.text_native), [lyrics]);
  const hasTranslation = useMemo(() => lyrics.some(l => l.text_translation), [lyrics]);

  useEffect(() => {
    if (!activeId) { setLyrics([]); return; }
    
    const fetchLyrics = async () => {
      setIsLoading(true);
      const { data } = await supabase.from('songs').select('lyrics_snippet').eq('id', activeId).single();
      
      if (data?.lyrics_snippet) {
        try { 
          const parsedLyrics = JSON.parse(data.lyrics_snippet);
          setLyrics(parsedLyrics); 

          const initialTime = (window as any).__musebuzzCurrentTime || 0;
          const initialIndex = parsedLyrics.findIndex((line: LyricLine) => {
              if (line.start === null) return false;
              const endTime = line.end !== null ? line.end : line.start + 5;
              return initialTime >= line.start && initialTime < endTime;
          });
          
          if (initialIndex !== -1) {
              activeLineIndexRef.current = initialIndex;
              setActiveLineIndex(initialIndex);

              setTimeout(() => {
                  const el = lineRefs.current[initialIndex];
                  const container = containerRef.current;
                  if (el && container) {
                      isProgrammaticScrollRef.current = true;
                      if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current);
                      
                      container.scrollTo({
                          top: el.offsetTop + (el.clientHeight / 2) - (container.clientHeight * 0.3),
                          behavior: 'auto' 
                      });
                      
                      unlockTimeoutRef.current = setTimeout(() => { 
                          isProgrammaticScrollRef.current = false; 
                      }, 200);
                  }
              }, 100); 
          }

        } catch { setLyrics([]); }
      } else { setLyrics([]); }
      
      setIsLoading(false);
    };
    fetchLyrics();
  }, [activeId]);

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

  // THE MATHEMATICAL AUTO-SCROLL
  useEffect(() => {
    if (!isAutoSyncing || activeLineIndex === -1) return; 
    if (!isOpen || activeView !== 'lyrics') return;

    const activeEl = lineRefs.current[activeLineIndex];
    const container = containerRef.current;

    if (activeEl && container) {
      const scrollTimeout = setTimeout(() => {
        const offsetTarget = container.clientHeight * 0.4; 
        const elTop = activeEl.offsetTop;
        const elHalfHeight = activeEl.clientHeight / 2;
        
        // 🟢 PREVENT OVERLAPPING TIMEOUTS
        isProgrammaticScrollRef.current = true;
        if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current);
        
        container.scrollTo({
          top: elTop + elHalfHeight - offsetTarget,
          behavior: 'smooth'
        });

        // Safe 800ms unlock window to cover long scrub jumps
        unlockTimeoutRef.current = setTimeout(() => {
            isProgrammaticScrollRef.current = false;
        }, 800);

      }, 50);
      return () => clearTimeout(scrollTimeout);
    }
  }, [activeLineIndex, isAutoSyncing, scriptMode, showTranslation, isOpen, activeView]);

  const handleScriptToggle = (mode: 'native' | 'romanized') => {
      isProgrammaticScrollRef.current = true;
      if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current);
      
      setScriptMode(mode);
      localStorage.setItem('musebuzz-script-mode', mode);
      
      unlockTimeoutRef.current = setTimeout(() => { isProgrammaticScrollRef.current = false; }, 800);
  };

  const handleTranslationToggle = () => {
      isProgrammaticScrollRef.current = true;
      if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current);
      
      const nextState = !showTranslation;
      setShowTranslation(nextState);
      localStorage.setItem('musebuzz-show-translation', String(nextState));
      
      unlockTimeoutRef.current = setTimeout(() => { isProgrammaticScrollRef.current = false; }, 800);
  };

  const handleUserInteraction = () => {
      if (!isOpen || activeView !== 'lyrics') return;
      if (!isProgrammaticScrollRef.current && isAutoSyncing) {
          setIsAutoSyncing(false);
      }
  };

  const getDisplayText = (line: LyricLine) => {
    if (scriptMode === 'native' && line.text_native) return line.text_native.trim();
    if (scriptMode === 'romanized' && line.text_romanized) return line.text_romanized.trim();
    return (line.text || line.text_romanized || line.text_native || "").trim();
  };

  if (isLoading) {
    return <div className="h-full w-full flex items-center justify-center text-neutral-500">Loading...</div>;
  }
  
  if (!lyrics.length) {
    return <div className="h-full w-full flex items-center justify-center text-neutral-500">Looks like we don't have lyrics for this song yet.</div>;
  }

  return (
    <div className="w-full h-full flex flex-col bg-transparent overflow-hidden relative">
      
      {(hasNative || hasTranslation) && (
        <div className="absolute top-4 right-6 z-[60] flex items-center gap-3">
          
          {hasNative && (
            <div className="flex bg-neutral-900/80 backdrop-blur-md rounded-full p-1 border border-neutral-800 shadow-xl">
              <button 
                onClick={() => handleScriptToggle('native')} 
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition ${scriptMode === 'native' ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white'}`}
              >
                Native
              </button>
              <button 
                onClick={() => handleScriptToggle('romanized')} 
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition ${scriptMode === 'romanized' ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white'}`}
              >
                English
              </button>
            </div>
          )}

          {hasTranslation && (
            <button 
              onClick={handleTranslationToggle} 
              className={`px-4 py-2 text-xs font-bold rounded-full border backdrop-blur-md transition shadow-xl ${showTranslation ? 'bg-purple-600 border-purple-600 text-white' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white'}`}
            >
              {showTranslation ? 'Hide Translation' : 'A / अ Translate'}
            </button>
          )}

        </div>
      )}

      <div 
        ref={containerRef}
        onScroll={handleUserInteraction}
        className="flex-1 overflow-y-auto scrollbar-hide relative"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 2%, black 10%, black 90%, transparent 98%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 2%, black 10%, black 90%, transparent 98%)'
        }}
      >
        <div className="flex flex-col max-w-4xl mx-auto px-6 pt-20 pb-32 text-left items-start relative">
          
          <div className="flex flex-col w-full gap-8">
            {lyrics.map((line, lineIdx) => {
              const isActiveLine = activeLineIndex === lineIdx;
              const hasPassed = activeLineIndex !== -1 && lineIdx < activeLineIndex && line.start !== null;

              const displayText = getDisplayText(line) || "• • •";

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
                  className="flex flex-col w-full cursor-pointer justify-start transition-transform duration-300 origin-left"
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

                  {showTranslation && line.text_translation && (
                    <span className={`text-sm italic mt-2 transition-colors duration-300 ${isActiveLine ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      "{line.text_translation}"
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
        </div>
      </div>

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
                          if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current);

                          const offsetTarget = containerRef.current.clientHeight * 0.3;
                          containerRef.current.scrollTo({
                              top: activeEl.offsetTop + (activeEl.clientHeight / 2) - offsetTarget,
                              behavior: 'smooth'
                          });
                          
                          unlockTimeoutRef.current = setTimeout(() => { 
                              isProgrammaticScrollRef.current = false; 
                          }, 600);
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