"use client";
import { useState, useRef, useEffect } from "react";
// ⚠️ Adjust this import to match your project's Supabase client setup
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Song {
  id: string;
  title: string;
  song_path: string;
  lyrics_snippet: string | null;
}

export default function AdminSyncStudio() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [listTitle, setListTitle] = useState<string | null>(null); // Tracks what list we are viewing

  const [rawText, setRawText] = useState("");
  const [lines, setLines] = useState<{ text: string; start: number | null }[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ==========================================
  // PHASE 1: DATABASE QUERIES
  // ==========================================
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    
    const { data, error } = await supabase
      .from('songs')
      .select('id, title, song_path, lyrics_snippet')
      .ilike('title', `%${searchQuery}%`)
      .limit(20);

    if (error) {
      console.error(error);
      alert("Error searching database");
    } else {
      setSearchResults(data || []);
      setListTitle(`Search Results for "${searchQuery}"`);
    }
    setIsSearching(false);
  };

  const handleFetchMissingLyrics = async () => {
    setIsSearching(true);
    setSearchQuery(""); // Clear the search bar
    
    // Query: Find where lyrics_snippet is null, order alphabetically A-Z
    const { data, error } = await supabase
      .from('songs')
      .select('id, title, song_path, lyrics_snippet')
      .is('lyrics_snippet', null)
      .order('title', { ascending: true })
      .limit(50); // Limit to 50 so we don't crash the browser if you have 10k songs

    if (error) {
      console.error(error);
      alert("Error fetching missing lyrics");
    } else {
      setSearchResults(data || []);
      setListTitle("To-Do List: Missing Lyrics (A-Z)");
    }
    setIsSearching(false);
  };

  const handleSelectSong = async (song: Song) => {
    setActiveSong(song);
    
    // ⚠️ IMPORTANT: Change 'songs' to whatever your Supabase storage bucket is named
    const { data } = supabase.storage.from('songs').getPublicUrl(song.song_path);
    setAudioUrl(data.publicUrl);
    
    if (song.lyrics_snippet) {
      try {
        const parsed = JSON.parse(song.lyrics_snippet);
        const raw = parsed.map((l: any) => l.text).join('\n');
        setRawText(raw);
      } catch {
        setRawText("");
      }
    } else {
      setRawText("");
    }
    
    setStep(2);
  };

  // ==========================================
  // PHASE 2 & 3: SETUP & SYNC ROOM
  // ==========================================
  const handleStartSyncing = () => {
    if (!rawText.trim()) return alert("Please paste lyrics first.");
    
    const parsedLines = rawText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ({ text: line, start: null }));
      
    setLines(parsedLines);
    setActiveIndex(0);
    setStep(3);
  };

  const handleSync = () => {
    if (!audioRef.current || activeIndex >= lines.length) return;
    const currentTime = Math.max(0, Number((audioRef.current.currentTime - 0.25).toFixed(2)));
    
    setLines((prev) => {
      const newLines = [...prev];
      newLines[activeIndex].start = currentTime;
      return newLines;
    });
    setActiveIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (activeIndex === 0 || !audioRef.current) return;
    const prevIndex = activeIndex - 1;
    setActiveIndex(prevIndex);
    
    setLines((prev) => {
      const newLines = [...prev];
      const previousTimestamp = newLines[prevIndex].start || 0;
      newLines[prevIndex].start = null;
      audioRef.current!.currentTime = Math.max(0, previousTimestamp - 1.0);
      return newLines;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (step === 3 && e.code === "Space") {
        e.preventDefault(); 
        handleSync();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, activeIndex, lines]);

  useEffect(() => {
    const activeEl = lineRefs.current[activeIndex];
    if (activeEl && containerRef.current && step === 3) {
      const scrollTimeout = setTimeout(() => {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return () => clearTimeout(scrollTimeout);
    }
  }, [activeIndex, step]);

  // ==========================================
  // PHASE 4: AUTO-SAVE TO SUPABASE
  // ==========================================
  const handleSaveToDatabase = async () => {
    if (!activeSong) return;
    setIsSaving(true);

    const payload = lines.map((line, idx) => {
      const isMusic = /^[\(\[].*?[\)\]]$/.test(line.text);
      return {
        type: isMusic ? "music" : "lyrics",
        text: line.text,
        start: line.start,
        end: idx < lines.length - 1 ? lines[idx + 1].start : (line.start || 0) + 5 
      };
    });

    const jsonString = JSON.stringify(payload);

    const { error } = await supabase
      .from('songs')
      .update({ lyrics_snippet: jsonString })
      .eq('id', activeSong.id);

    setIsSaving(false);

    if (error) {
      console.error(error);
      alert("Failed to save to database!");
    } else {
      alert("✅ Lyrics successfully synced and saved!");
      setStep(1); 
      // Automatically refresh the missing lyrics list if we were looking at it
      if (listTitle?.includes("Missing")) {
        handleFetchMissingLyrics();
      } else {
        setSearchQuery("");
        setSearchResults([]);
        setListTitle(null);
      }
    }
  };

  // --- RENDERING ---
  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-purple-500/30 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <h1 className="text-3xl font-black text-purple-400 tracking-tight">Admin Sync Studio</h1>
          {activeSong && step > 1 && (
            <div className="text-sm font-medium text-neutral-400 bg-neutral-900 px-4 py-2 rounded-full border border-neutral-800">
              Editing: <span className="text-white">{activeSong.title}</span>
            </div>
          )}
        </div>

        {/* STEP 1: DATABASE SEARCH */}
        {step === 1 && (
          <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-800 shadow-xl space-y-6">
            <div>
              <label className="block text-sm text-neutral-400 mb-2 font-medium">Find Song to Sync</label>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  className="flex-1 bg-neutral-950 p-4 rounded-xl text-neutral-200 border border-neutral-800 outline-none focus:border-purple-500 transition"
                  placeholder="Search by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button onClick={handleSearch} disabled={isSearching} className="bg-purple-600 hover:bg-purple-500 px-8 rounded-xl font-bold transition">
                  {isSearching ? "..." : "Search"}
                </button>
              </div>
            </div>

            {/* THE NEW MISSING LYRICS BUTTON */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-neutral-800" />
              <span className="text-neutral-500 text-sm font-medium uppercase tracking-widest">OR</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            <button 
              onClick={handleFetchMissingLyrics} 
              disabled={isSearching} 
              className="w-full bg-neutral-950 border border-neutral-700 hover:border-purple-500 text-neutral-300 hover:text-white py-4 rounded-xl font-bold transition flex justify-center items-center gap-2"
            >
              📋 Show All Songs Missing Lyrics (A-Z)
            </button>

            {searchResults.length > 0 && (
              <div className="space-y-3 mt-8">
                {listTitle && <h3 className="text-purple-400 font-bold mb-4">{listTitle}</h3>}
                {searchResults.map((song) => (
                  <div key={song.id} className="flex items-center justify-between bg-neutral-950 p-4 rounded-xl border border-neutral-800 hover:border-purple-500/50 transition cursor-pointer" onClick={() => handleSelectSong(song)}>
                    <div className="font-medium">{song.title}</div>
                    <div className="flex items-center gap-3">
                      {song.lyrics_snippet ? (
                        <span className="text-xs bg-emerald-900/30 text-emerald-400 px-3 py-1 rounded-full border border-emerald-800/50 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Synced
                        </span>
                      ) : (
                        <span className="text-xs bg-red-900/30 text-red-400 px-3 py-1 rounded-full border border-red-800/50 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-400" /> No Lyrics
                        </span>
                      )}
                      <button className="text-sm text-purple-400 hover:text-purple-300 font-bold ml-4">
                        {song.lyrics_snippet ? "Edit Sync ➔" : "Start Sync ➔"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {listTitle && searchResults.length === 0 && !isSearching && (
              <p className="text-neutral-500 text-center mt-6">No songs found in this list.</p>
            )}
          </div>
        )}

        {/* STEP 2: PASTE LYRICS */}
        {step === 2 && (
          <div className="space-y-6">
            <button onClick={() => setStep(1)} className="text-neutral-500 hover:text-white mb-4 text-sm font-medium">← Back to List</button>
            <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-800 shadow-xl">
              <label className="block text-sm text-neutral-400 mb-2 font-medium">Paste Raw Lyrics (Line by Line)</label>
              <textarea 
                className="w-full h-96 bg-neutral-950 p-6 rounded-xl text-neutral-200 border border-neutral-800 outline-none focus:border-purple-500 transition font-mono leading-relaxed"
                placeholder="[Music]&#10;Line 1..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <button onClick={handleStartSyncing} className="w-full mt-6 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl transition shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                Initialize Sync Room
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: THE SYNC ROOM */}
        {step === 3 && (
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden flex flex-col h-[80vh]">
            
            <div className="bg-neutral-950 border-b border-neutral-800 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0 z-50">
              {audioUrl && <audio ref={audioRef} src={audioUrl} controls className="w-full md:w-1/2" />}
              <div className="flex gap-4 w-full md:w-auto">
                <button onClick={handleUndo} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-6 py-3 rounded-xl transition font-medium">
                  ↩ Undo Line
                </button>
                <button onClick={handleSaveToDatabase} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-xl font-bold transition text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  {isSaving ? "Saving..." : "Save to Database"}
                </button>
              </div>
            </div>

            <div ref={containerRef} className="flex-1 overflow-y-auto p-8 relative scrollbar-hide">
              <div className="max-w-3xl mx-auto text-center">
                <p className="text-neutral-500 text-sm mb-12 uppercase tracking-widest font-bold">
                  Tap <strong className="text-purple-400 bg-purple-400/10 px-2 py-1 rounded">SPACEBAR</strong> to sync
                </p>
                <div className="h-[30vh]" /> 
                
                <div className="flex flex-col gap-6">
                  {lines.map((line, idx) => {
                    const isActive = idx === activeIndex;
                    const isDone = idx < activeIndex;
                    
                    return (
                      <div 
                        key={idx} 
                        ref={(el) => { lineRefs.current[idx] = el; }}
                        className={`text-3xl transition-all duration-300 ${
                          isActive ? "text-white font-black drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" : 
                          isDone ? "text-purple-500/50 font-medium blur-[0.5px]" : "text-neutral-700 font-medium"
                        }`}
                      >
                        {isDone && <span className="text-xs mr-4 font-mono text-purple-400/40">[{line.start?.toFixed(2)}s]</span>}
                        {line.text}
                      </div>
                    );
                  })}
                </div>
                
                <div className="h-[40vh]" /> 
              </div>
            </div>

          </div>
        )}
        
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}