'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import LyricsIngestionForm, { UnsyncedLyricLine } from './components/LyricsIngestionForm';

export default function AdminLyricsSyncPage() {
  const supabase = useSupabaseClient();
  
  // Pipeline State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [songs, setSongs] = useState<any[]>([]);
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyUnsynced, setShowOnlyUnsynced] = useState(false);

  // Syncing State
  const [lyricsData, setLyricsData] = useState<UnsyncedLyricLine[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // 1. FETCH SONGS ON MOUNT
  useEffect(() => {
    const fetchSongs = async () => {
      const { data } = await supabase
        .from('songs')
        .select('id, title, song_path, lyrics_snippet, albums(artists(name))')
        .order('created_at', { ascending: false });
      
      if (data) setSongs(data);
    };
    fetchSongs();
  }, [supabase]);

  // Filter logic
  const filteredSongs = useMemo(() => {
    return songs.filter((song) => {
      const matchesSearch = 
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (song.albums?.artists?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = showOnlyUnsynced ? !song.lyrics_snippet : true;
      
      return matchesSearch && matchesFilter;
    });
  }, [songs, searchQuery, showOnlyUnsynced]);

  // 2. HANDLE SONG SELECTION
  const handleSelectSong = (song: any) => {
    setSelectedSong(song);
    const { data } = supabase.storage.from('songs').getPublicUrl(song.song_path);
    setAudioUrl(data.publicUrl);
    setStep(2);
  };

  // 3. HANDLE INGESTION SUCCESS
  const handleLyricsProcessed = (zippedLyrics: UnsyncedLyricLine[]) => {
    setLyricsData(zippedLyrics);
    setStep(3);
  };

  // 4. THE SPACEBAR SYNC LOGIC
  const stampTime = () => {
    if (!audioRef.current || currentLineIndex >= lyricsData.length) return;
    
    const currentTime = audioRef.current.currentTime;

    setLyricsData((prev) => {
      const newData = [...prev];
      newData[currentLineIndex].start = currentTime;
      if (currentLineIndex > 0 && newData[currentLineIndex - 1].end === null) {
        newData[currentLineIndex - 1].end = currentTime;
      }
      return newData;
    });

    setCurrentLineIndex((prev) => prev + 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && step === 3) {
        e.preventDefault();
        stampTime();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, currentLineIndex, lyricsData]);

  useEffect(() => {
    if (activeLineRef.current && scrollRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLineIndex]);

  // 5. UNDO LOGIC
  const handleUndo = () => {
    if (currentLineIndex === 0) return;
    
    setLyricsData((prev) => {
      const newData = [...prev];
      const prevIndex = currentLineIndex - 1;
      newData[prevIndex].start = null;
      if (prevIndex > 0) {
        newData[prevIndex - 1].end = null;
      }
      return newData;
    });

    setCurrentLineIndex((prev) => prev - 1);
  };

  // 6. SAVE TO DATABASE
  const handleSaveToDB = async () => {
    if (!selectedSong) return;
    setIsSaving(true);

    const finalData = [...lyricsData];
    const lastLine = finalData[finalData.length - 1];

    if (finalData.length > 0 && lastLine.end === null && lastLine.start !== null) {
        lastLine.end = lastLine.start + 5;
    }

    const { error } = await supabase
      .from('songs')
      .update({ lyrics_snippet: JSON.stringify(finalData) })
      .eq('id', selectedSong.id);

    setIsSaving(false);
    
    if (error) {
      alert("Error saving lyrics: " + error.message);
    } else {
      alert("Success! Lyrics are now perfectly synced.");
      setStep(1);
      setSelectedSong(null);
      setLyricsData([]);
      setCurrentLineIndex(0);
      
      const { data } = await supabase
        .from('songs')
        .select('id, title, song_path, lyrics_snippet, albums(artists(name))')
        .order('created_at', { ascending: false });
      if (data) setSongs(data);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      
      {/* 🟢 CONDITIONAL HEADER: Only show on Steps 1 and 2 to save space in Step 3 */}
      {step !== 3 && (
        <div className="bg-neutral-900 border-b border-neutral-800 p-6 sticky top-0 z-50">
          <h1 className="text-3xl font-black text-purple-500">MuseBuzz Sync Engine</h1>
          <p className="text-neutral-400">Step {step} of 3</p>
        </div>
      )}

      {/* ==============================================================
          STEP 1: SELECT A SONG
      ============================================================== */}
      {step === 1 && (
        <div className="p-8 max-w-4xl mx-auto pb-24">
          <h2 className="text-2xl font-bold mb-6">Select a track to sync</h2>
          
          <div className="flex flex-col md:flex-row gap-4 mb-8 bg-neutral-900 p-4 rounded-xl border border-neutral-800">
            <input 
              type="text" 
              placeholder="Search by song or artist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-black border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
            />
            <label className="flex items-center gap-2 cursor-pointer bg-black px-4 py-2 rounded-lg border border-neutral-700 hover:border-neutral-500 transition">
              <input 
                type="checkbox" 
                checked={showOnlyUnsynced}
                onChange={(e) => setShowOnlyUnsynced(e.target.checked)}
                className="w-4 h-4 accent-purple-500"
              />
              <span className="text-sm font-medium text-neutral-300">Hide Synced Songs</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSongs.map((song) => (
              <div 
                key={song.id} 
                onClick={() => handleSelectSong(song)}
                className="bg-neutral-900 border border-neutral-800 hover:border-purple-500 p-4 rounded-xl cursor-pointer transition flex items-center justify-between group"
              >
                <div className="overflow-hidden pr-4">
                  <h3 className="font-bold text-lg group-hover:text-purple-400 transition truncate">{song.title}</h3>
                  <p className="text-neutral-500 text-sm truncate">{song.albums?.artists?.name || 'Unknown Artist'}</p>
                </div>
                {song.lyrics_snippet ? (
                  <span className="text-[10px] uppercase tracking-wider bg-green-500/20 text-green-500 px-2 py-1 rounded font-bold shrink-0">Synced</span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wider bg-neutral-800 text-neutral-400 px-2 py-1 rounded font-bold shrink-0">Pending</span>
                )}
              </div>
            ))}
            {filteredSongs.length === 0 && (
              <div className="col-span-1 md:col-span-2 text-center py-12 text-neutral-500">
                 No songs found matching your search.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==============================================================
          STEP 2: PASTE LYRICS (Ingestion Form)
      ============================================================== */}
      {step === 2 && selectedSong && (
        <div className="p-8 pb-24">
          <div className="max-w-6xl mx-auto mb-6 flex items-center gap-4">
            <button onClick={() => setStep(1)} className="text-neutral-400 hover:text-white transition">
               ← Back
            </button>
            <h2 className="text-xl font-bold text-purple-400">
              Syncing: <span className="text-white">{selectedSong.title}</span>
            </h2>
          </div>
          <LyricsIngestionForm onProcessLyrics={handleLyricsProcessed} />
        </div>
      )}

      {/* ==============================================================
          STEP 3: THE FOCUS MODE SYNC ARENA
      ============================================================== */}
      {step === 3 && selectedSong && (
        // 🟢 Absolute full-screen container hijack
        <div className="fixed inset-0 bg-black z-[100] flex flex-col h-screen w-full">
          
          {/* 🟢 COMPACT TOP CONTROL BAR */}
          <div className="bg-neutral-900 border-b border-neutral-800 p-4 flex items-center justify-between shrink-0 shadow-xl z-50">
            
            {/* Left: Exit & Counter */}
            <div className="flex items-center gap-6 w-1/4">
              <button 
                onClick={() => { if(confirm("Are you sure? Unsaved sync progress will be lost.")) setStep(1); }} 
                className="text-neutral-400 hover:text-white transition font-bold"
              >
                 ← Exit
              </button>
              <div className="text-sm font-bold bg-neutral-800 px-3 py-1.5 rounded-lg text-neutral-300">
                 Line <span className="text-purple-400">{currentLineIndex}</span> / {lyricsData.length}
              </div>
            </div>

            {/* Center: Audio Player */}
            <div className="flex-1 flex justify-center px-4">
              {audioUrl && (
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  controls 
                  className="w-full max-w-3xl h-10" // Force minimal height on audio player
                  onKeyDown={(e) => { if(e.code === 'Space') e.preventDefault(); }} 
                />
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-end gap-3 w-1/4">
               <button 
                 onClick={handleUndo} 
                 disabled={currentLineIndex === 0}
                 className="text-sm font-bold bg-neutral-800 hover:bg-red-500/20 hover:text-red-400 text-neutral-400 px-4 py-2 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
               >
                 ⟲ Undo
               </button>
               <button 
                 onClick={handleSaveToDB}
                 disabled={isSaving || currentLineIndex < lyricsData.length}
                 className="bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-2 px-6 rounded-lg transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
               >
                 {isSaving ? 'Saving...' : 'Save to DB'}
               </button>
            </div>
          </div>

          {/* 🟢 FULL SCREEN SCROLLING LYRICS */}
          <div 
             ref={scrollRef}
             className="flex-1 overflow-y-auto bg-black p-8 px-12 space-y-6 relative"
          >
            {/* Spacer to push the first line down a bit */}
            <div className="h-[10vh]" />

            <div className="max-w-4xl mx-auto space-y-6">
              {lyricsData.map((line, idx) => {
                const isPast = idx < currentLineIndex;
                const isActive = idx === currentLineIndex;
                const isFuture = idx > currentLineIndex;

                let stateClass = "";
                if (isPast) stateClass = "opacity-30";
                if (isActive) stateClass = "bg-neutral-900 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)] scale-[1.02] z-10";
                if (isFuture) stateClass = "opacity-50 border-neutral-800";

                return (
                  <div 
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    className={`p-6 rounded-xl border transition-all duration-300 ${stateClass}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                       <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-purple-400' : 'text-neutral-600'}`}>
                         Line {idx + 1}
                       </span>
                       {line.start !== null && (
                         <span className="text-xs text-green-500 font-mono bg-green-500/10 px-2 py-1 rounded">
                           {line.start.toFixed(2)}s
                         </span>
                       )}
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      {line.text_native && (
                        <p className={`text-2xl font-bold ${isActive ? 'text-white' : 'text-neutral-300'}`}>
                          {line.text_native}
                        </p>
                      )}
                      
                      <p className={`text-lg ${isActive ? 'text-purple-300' : 'text-neutral-500'} ${line.text_native ? 'mt-1' : 'font-bold text-2xl text-white'}`}>
                        {line.text_romanized}
                      </p>
                      
                      {line.text_translation && (
                        <p className={`text-sm italic mt-2 ${isActive ? 'text-neutral-400' : 'text-neutral-600'}`}>
                          "{line.text_translation}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🟢 MASSIVE BOTTOM PADDING: Ensures you can scroll all the way down freely */}
            <div className="h-[60vh]" />
          </div>

        </div>
      )}

    </div>
  );
}