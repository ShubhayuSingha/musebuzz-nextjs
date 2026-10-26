// src/app/lyrics-master/components/AppleLyricsRenderer.tsx

"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { UnifiedLyrics, TimedLine } from "../types/lyricsMaster.types";

interface AppleLyricsRendererProps {
  lyrics: UnifiedLyrics | null;
  currentTimeMs: number;
  isPlaying?: boolean;
  onSeek: (ms: number) => void;
}

interface RenderItem {
  type: "lyric" | "instrumental";
  line?: TimedLine;
  startMs: number;
  endMs: number;
  id: string;
}

/**
 * Calculates exact 0-100% completion for any timestamp window
 */
function getFillPercentage(
  startMs: number,
  endMs: number,
  currentMs: number,
): number {
  if (currentMs <= startMs) return 0;
  if (currentMs >= endMs) return 100;
  const duration = endMs - startMs;
  if (duration <= 0) return 100;
  return Math.min(100, Math.max(0, ((currentMs - startMs) / duration) * 100));
}

export const AppleLyricsRenderer: React.FC<AppleLyricsRendererProps> = ({
  lyrics,
  currentTimeMs,
  isPlaying = true,
  onSeek,
}) => {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const segmentRefs = useRef<{ [key: string]: HTMLSpanElement | null }>({});

  // High-precision clock anchor for rAF sub-frame interpolation
  const lastTimeRef = useRef<{ audioMs: number; perfNow: number }>({
    audioMs: currentTimeMs,
    perfNow: typeof performance !== "undefined" ? performance.now() : 0,
  });

  // Sync high-precision anchor whenever audio element pushes a new timestamp
  useEffect(() => {
    lastTimeRef.current = {
      audioMs: currentTimeMs,
      perfNow: performance.now(),
    };
  }, [currentTimeMs]);

  // Build list including lyric lines and instrumental breaks
  const renderItems = useMemo<RenderItem[]>(() => {
    if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) return [];

    const items: RenderItem[] = [];
    const GAP_THRESHOLD_MS = 4000;

    if (lyrics.lines[0].startMs > GAP_THRESHOLD_MS) {
      items.push({
        type: "instrumental",
        startMs: 0,
        endMs: lyrics.lines[0].startMs,
        id: "inst-intro",
      });
    }

    lyrics.lines.forEach((line, idx) => {
      items.push({
        type: "lyric",
        line,
        startMs: line.startMs,
        endMs: line.endMs,
        id: `line-${line.id || idx}`,
      });

      if (idx < lyrics.lines.length - 1) {
        const nextLine = lyrics.lines[idx + 1];
        const gapMs = nextLine.startMs - line.endMs;

        if (gapMs >= GAP_THRESHOLD_MS) {
          items.push({
            type: "instrumental",
            startMs: line.endMs,
            endMs: nextLine.startMs,
            id: `inst-${idx}`,
          });
        }
      }
    });

    return items;
  }, [lyrics]);

  const activeIndex = renderItems.findIndex(
    (item) => currentTimeMs >= item.startMs && currentTimeMs <= item.endMs,
  );

  // Auto-scroll active line to center view
  useEffect(() => {
    if (activeIndex !== -1 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  // Direct GPU manipulation at 60Hz - 144Hz via requestAnimationFrame
  useEffect(() => {
    let animId: number;

    const tick = () => {
      const now = performance.now();
      const elapsedSinceAudioTick = isPlaying
        ? now - lastTimeRef.current.perfNow
        : 0;
      const smoothCurrentMs =
        lastTimeRef.current.audioMs + elapsedSinceAudioTick;

      // Direct DOM style mutation without triggering React renders
      renderItems.forEach((item) => {
        if (item.type !== "lyric" || !item.line) return;

        const line = item.line;
        if (line.segments && line.segments.length > 0) {
          line.segments.forEach((seg, sIdx) => {
            const key = `${item.id}-seg-${sIdx}`;
            const el = segmentRefs.current[key];
            if (el) {
              const pct = getFillPercentage(
                seg.startMs,
                seg.endMs,
                smoothCurrentMs,
              );
              el.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
            }
          });
        } else {
          const key = `${item.id}-line`;
          const el = segmentRefs.current[key];
          if (el) {
            const pct = getFillPercentage(
              line.startMs,
              line.endMs,
              smoothCurrentMs,
            );
            el.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
          }
        }
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [renderItems, isPlaying]);

  if (!lyrics || lyrics.lines.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-neutral-500 text-sm">
        No lyrics loaded for rendering. Select a song and fetch lyrics above.
      </div>
    );
  }

  return (
    <div className="relative h-[550px] overflow-y-auto px-6 py-36 custom-scrollbar bg-black/60 rounded-xl">
      <div className="space-y-8">
        {renderItems.map((item, idx) => {
          const isActive = idx === activeIndex;
          const isPassed = currentTimeMs > item.endMs;

          if (item.type === "instrumental") {
            return (
              <div
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                onClick={() => onSeek(item.startMs)}
                className={`cursor-pointer transition-all duration-500 py-3 flex items-center gap-3 origin-left ${
                  isActive
                    ? "scale-110 opacity-100"
                    : "opacity-25 blur-[1px] hover:opacity-50"
                }`}
              >
                <div className="flex items-center gap-2 bg-purple-950/40 border border-purple-500/30 px-4 py-2 rounded-full backdrop-blur-md">
                  <span className="text-xs font-mono text-purple-300 font-bold uppercase tracking-wider mr-1">
                    Music
                  </span>
                  <div
                    className={`w-2.5 h-2.5 rounded-full bg-purple-400 ${
                      isActive
                        ? "animate-bounce shadow-[0_0_10px_rgba(168,85,247,0.9)]"
                        : ""
                    }`}
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className={`w-2.5 h-2.5 rounded-full bg-purple-400 ${
                      isActive
                        ? "animate-bounce shadow-[0_0_10px_rgba(168,85,247,0.9)]"
                        : ""
                    }`}
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className={`w-2.5 h-2.5 rounded-full bg-purple-400 ${
                      isActive
                        ? "animate-bounce shadow-[0_0_10px_rgba(168,85,247,0.9)]"
                        : ""
                    }`}
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            );
          }

          const line = item.line!;
          const hasSegments = Boolean(
            line.segments && line.segments.length > 0,
          );

          return (
            <div
              key={item.id}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              onClick={() => onSeek(line.startMs)}
              className={`cursor-pointer text-2xl sm:text-3xl font-extrabold transition-all duration-300 origin-left select-none ${
                isActive
                  ? "scale-105 opacity-100 blur-0"
                  : isPassed
                    ? "opacity-40 blur-[0.5px]"
                    : "opacity-25 blur-[1px] hover:opacity-60"
              }`}
            >
              {hasSegments ? (
                <div className="flex flex-wrap gap-x-2.5 leading-snug">
                  {line.segments!.map((seg, sIdx) => {
                    const key = `${item.id}-seg-${sIdx}`;
                    return (
                      <span key={sIdx} className="relative inline-block">
                        {/* Layer 1: Dimmed Background Text */}
                        <span className="text-white/30">{seg.text}</span>

                        {/* Layer 2: Glowing Foreground Text (GPU clipped via rAF) */}
                        <span
                          ref={(el) => {
                            segmentRefs.current[key] = el;
                          }}
                          className="absolute inset-0 text-white drop-shadow-[0_0_12px_rgba(216,180,254,0.9)] pointer-events-none select-none"
                          style={{
                            clipPath: "inset(0 100% 0 0)",
                            willChange: "clip-path",
                          }}
                        >
                          {seg.text}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="relative inline-block">
                  {/* Layer 1: Dimmed Background Line */}
                  <span className="text-white/30 leading-snug">
                    {line.text}
                  </span>

                  {/* Layer 2: Glowing Foreground Line (GPU clipped via rAF) */}
                  <span
                    ref={(el) => {
                      segmentRefs.current[`${item.id}-line`] = el;
                    }}
                    className="absolute inset-0 text-white drop-shadow-[0_0_12px_rgba(216,180,254,0.9)] leading-snug pointer-events-none select-none"
                    style={{
                      clipPath: "inset(0 100% 0 0)",
                      willChange: "clip-path",
                    }}
                  >
                    {line.text}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
