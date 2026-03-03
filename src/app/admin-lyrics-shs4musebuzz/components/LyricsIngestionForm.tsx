'use client';

import { useState } from 'react';

// The new unified JSON structure (before syncing)
export interface UnsyncedLyricLine {
  text_native: string;
  text_romanized: string;
  text_translation: string;
  start: number | null; // <-- Changed to allow numbers
  end: number | null;   // <-- Changed to allow numbers
}

interface LyricsIngestionFormProps {
  // This function sends the perfectly formatted JSON array to your syncing screen
  onProcessLyrics: (zippedLyrics: UnsyncedLyricLine[]) => void;
}

export default function LyricsIngestionForm({ onProcessLyrics }: LyricsIngestionFormProps) {
  const [romanized, setRomanized] = useState(''); // Primary (English/Lettered)
  const [native, setNative] = useState('');       // Optional (Hindi, Spanish, etc.)
  const [translation, setTranslation] = useState(''); // Optional (English Meaning)
  
  const [error, setError] = useState<string | null>(null);

  const handleProcess = () => {
    setError(null);

    // 1. Clean the inputs: Remove trailing blank lines at the very bottom 
    // to prevent accidental line count mismatches, but preserve blank lines IN THE MIDDLE.
    const cleanRomanized = romanized.trimEnd();
    const cleanNative = native.trimEnd();
    const cleanTranslation = translation.trimEnd();

    if (!cleanRomanized) {
      setError("The English/Romanized box is required.");
      return;
    }

    // 2. Split into arrays based on line breaks (\n)
    const romanizedLines = cleanRomanized.split('\n');
    const nativeLines = cleanNative ? cleanNative.split('\n') : [];
    const translationLines = cleanTranslation ? cleanTranslation.split('\n') : [];

    const baseCount = romanizedLines.length;

    // 3. Validation: The Safety Net
    if (nativeLines.length > 0 && nativeLines.length !== baseCount) {
      setError(`Mismatch! English Lettered has ${baseCount} lines, but Native has ${nativeLines.length} lines.`);
      return;
    }

    if (translationLines.length > 0 && translationLines.length !== baseCount) {
      setError(`Mismatch! English Lettered has ${baseCount} lines, but Translation has ${translationLines.length} lines.`);
      return;
    }

    // 4. The Zip: Combine them into our unified JSON objects
    const zippedLyrics: UnsyncedLyricLine[] = romanizedLines.map((line, index) => {
      return {
        text_romanized: line.trim(),
        text_native: nativeLines.length > 0 ? nativeLines[index].trim() : "",
        text_translation: translationLines.length > 0 ? translationLines[index].trim() : "",
        start: null,
        end: null
      };
    });

    // 5. Send it up to the parent component to begin the Spacebar Syncing phase!
    onProcessLyrics(zippedLyrics);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-black rounded-xl border border-neutral-800">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">1. Paste Lyrics</h2>
        <p className="text-neutral-400 text-sm">
          Paste the lyrics into the corresponding boxes. 
          <strong className="text-white"> Important:</strong> Every box you use MUST have the exact same number of lines. Use blank lines for instrumental breaks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Box 1: Native (Optional) */}
        <div className="flex flex-col">
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
            Native Script (Optional)
          </label>
          <textarea
            value={native}
            onChange={(e) => setNative(e.target.value)}
            placeholder="e.g., तुम ही हो..."
            className="w-full h-96 bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500 transition resize-none font-sans"
          />
        </div>

        {/* Box 2: Romanized / English Lettered (Mandatory) */}
        <div className="flex flex-col">
          <label className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">
            English Lettered (Required)
          </label>
          <textarea
            value={romanized}
            onChange={(e) => setRomanized(e.target.value)}
            placeholder="e.g., Tum hi ho..."
            className="w-full h-96 bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500 transition resize-none font-sans"
          />
        </div>

        {/* Box 3: Translation (Optional) */}
        <div className="flex flex-col">
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
            Translation (Optional)
          </label>
          <textarea
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="e.g., You are the one..."
            className="w-full h-96 bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500 transition resize-none font-sans"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleProcess}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-full transition shadow-lg active:scale-95"
        >
          Verify & Proceed to Syncing ➔
        </button>
      </div>
    </div>
  );
}