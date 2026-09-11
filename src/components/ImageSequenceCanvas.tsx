import { useEffect, useRef, useState } from "react";

interface Props {
  /** scroll progress 0..1 */
  progress: number;
  frameCount?: number;
  /** path builder for each frame */
  framePath?: (i: number) => string;
  className?: string;
}

/**
 * Optional canvas image-sequence player driven by scroll progress.
 * If frames are missing it silently disables itself — the CSS machine
 * remains the visual. Future path: /frames/frame_0001.webp ...
 */
export default function ImageSequenceCanvas({
  progress,
  frameCount = 180,
  framePath = (i) => `/frames/frame_${String(i + 1).padStart(4, "0")}.webp`,
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [available, setAvailable] = useState(false);

  // Probe the first frame. If it 404s, stay disabled.
  useEffect(() => {
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (cancelled) return;
      setAvailable(true);
      // lazy-load the rest
      const imgs: HTMLImageElement[] = [];
      for (let i = 0; i < frameCount; i++) {
        const img = new Image();
        img.src = framePath(i);
        imgs.push(img);
      }
      imagesRef.current = imgs;
    };
    probe.onerror = () => !cancelled && setAvailable(false);
    probe.src = framePath(0);
    return () => {
      cancelled = true;
    };
  }, [frameCount, framePath]);

  useEffect(() => {
    if (!available) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const idx = Math.min(
      frameCount - 1,
      Math.max(0, Math.floor(progress * (frameCount - 1)))
    );
    const img = imagesRef.current[idx];
    if (img && img.complete && img.naturalWidth) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
    }
  }, [progress, available, frameCount]);

  if (!available) return null;
  return (
    <canvas
      ref={canvasRef}
      className={`h-full w-full object-cover ${className}`}
      aria-hidden="true"
    />
  );
}
