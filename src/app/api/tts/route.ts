import { NextRequest, NextResponse } from "next/server";
import { EdgeTTS } from "@andresaya/edge-tts";

// In-memory cache for audio buffers (retains recent ~100 announcements)
const audioCache = new Map<string, Buffer>();

// Unicode script regular expressions
const HANGUL_REGEX = /[\uAC00-\uD7AF\u1100-\u11FF]/;
const CJK_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
const BENGALI_REGEX = /[\u0980-\u09FF]/;
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

/**
 * Intelligently picks the optimal Azure Neural TTS voice for a given text snippet,
 * respecting native scripts first, then regional language metadata (for Romanized text or Latin languages).
 */
function pickVoice(text: string, songLang = ""): string {
  // 1. Native Script Priority (always authentic)
  if (HANGUL_REGEX.test(text)) return "ko-KR-SunHiNeural";
  if (CJK_REGEX.test(text)) return "ja-JP-NanamiNeural";
  if (BENGALI_REGEX.test(text)) return "bn-IN-TanishaaNeural";
  if (DEVANAGARI_REGEX.test(text)) return "hi-IN-SwaraNeural";

  // 2. Language metadata for Romanized or Latin-script foreign languages
  const l = (songLang || "").toLowerCase().trim();

  // For Bengali & Hindi written in Latin alphabet ("Ekhon Onek Raat", "Tum Hi Ho"):
  // en-IN-NeerjaNeural produces natural Indian/Bengali accent on English letters,
  // whereas bn-IN-TanishaaNeural falls back to American English phonetics on Latin script.
  if (l === "bn" || l === "bengali" || l.includes("bangla") || l.includes("bengali")) {
    return BENGALI_REGEX.test(text) ? "bn-IN-TanishaaNeural" : "en-IN-NeerjaNeural";
  }
  if (l === "hi" || l === "hindi" || l.includes("hindi")) {
    return DEVANAGARI_REGEX.test(text) ? "hi-IN-SwaraNeural" : "en-IN-NeerjaNeural";
  }
  if (l === "es" || l === "spanish" || l.includes("spanish") || l.includes("español")) return "es-ES-ElviraNeural";
  if (l === "de" || l === "german" || l.includes("deutsch") || l.includes("german")) return "de-DE-KatjaNeural";
  if (l === "fr" || l === "french" || l.includes("french") || l.includes("français")) return "fr-FR-DeniseNeural";
  if (l === "it" || l === "italian" || l.includes("italian") || l.includes("italiano")) return "it-IT-ElsaNeural";
  if (l === "ko" || l === "korean" || l.includes("korean")) return "ko-KR-SunHiNeural";
  if (l === "ja" || l === "japanese" || l.includes("japanese")) return "ja-JP-NanamiNeural";

  // 3. Default high-fidelity English/multilingual voice
  return "en-US-AvaMultilingualNeural";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title")?.trim() || "";
  const artist = searchParams.get("artist")?.trim() || "";
  const language = searchParams.get("language")?.trim().toLowerCase() || "en";
  const narrationText = searchParams.get("narration_text")?.trim() || "";

  if (!title && !narrationText) {
    return new NextResponse("Title or narration_text parameter is required", { status: 400 });
  }

  const cacheKey = `${title}|${artist}|${language}|${narrationText}`.toLowerCase();
  const cached = audioCache.get(cacheKey);
  if (cached) {
    return new Response(new Uint8Array(cached), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400"
      }
    });
  }

  try {
    const tts = new EdgeTTS();
    let finalAudioBuffer: Buffer;

    if (narrationText) {
      // Custom / Native pronunciation script provided
      if (narrationText.includes(" by ")) {
        const parts = narrationText.split(" by ");
        const nTitle = parts[0].trim();
        const nArtist = parts.slice(1).join(" by ").trim();

        const titleVoice = pickVoice(nTitle, language);
        const artistVoice = nArtist ? pickVoice(nArtist, language) : titleVoice;

        if (!nArtist || titleVoice === artistVoice) {
          const phrase = nArtist ? `Up next, ${nTitle} by ${nArtist}.` : `Up next, ${nTitle}.`;
          const result = await tts.generate(phrase, titleVoice);
          finalAudioBuffer = result.audio;
        } else {
          // Dual voice stitch
          const [seg1, seg2] = await Promise.all([
            tts.generate(`Up next, ${nTitle} by `, titleVoice),
            tts.generate(`${nArtist}.`, artistVoice)
          ]);
          finalAudioBuffer = Buffer.concat([seg1.audio, seg2.audio]);
        }
      } else {
        const voice = pickVoice(narrationText, language);
        const phrase = `Up next, ${narrationText}.`;
        const result = await tts.generate(phrase, voice);
        finalAudioBuffer = result.audio;
      }
    } else {
      // Fallback: Default English / raw metadata logic
      const titleVoice = pickVoice(title, language);
      const artistVoice = artist ? pickVoice(artist, language) : titleVoice;

      if (!artist || titleVoice === artistVoice) {
        // Single voice: entire announcement spoken natively together
        const phrase = artist ? `Up next, ${title} by ${artist}.` : `Up next, ${title}.`;
        const result = await tts.generate(phrase, titleVoice);
        finalAudioBuffer = result.audio;
      } else {
        // Dual-voice stitching:
        // Segment 1 (Title) with title's voice (e.g. English "Up next, Shining by ")
        // Segment 2 (Artist) with artist's voice (e.g. Korean "김한겸.")
        const [seg1, seg2] = await Promise.all([
          tts.generate(`Up next, ${title} by `, titleVoice),
          tts.generate(`${artist}.`, artistVoice)
        ]);
        finalAudioBuffer = Buffer.concat([seg1.audio, seg2.audio]);
      }
    }

    if (finalAudioBuffer && finalAudioBuffer.length > 0) {
      if (audioCache.size >= 100) {
        const oldestKey = audioCache.keys().next().value;
        if (oldestKey) audioCache.delete(oldestKey);
      }
      audioCache.set(cacheKey, finalAudioBuffer);

      return new Response(new Uint8Array(finalAudioBuffer), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        }
      });
    }

    return new NextResponse("Failed to generate speech", { status: 500 });
  } catch (err: any) {
    console.error("[TTS API Error]:", err);
    return new NextResponse(err?.message || "Internal TTS Error", { status: 500 });
  }
}
