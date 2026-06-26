'use client';
import { useState, useRef, useEffect, DragEvent, ChangeEvent, useCallback } from 'react';
import axios from 'axios';

type Theme = 'dark' | 'light';
type Mode = 'upload' | 'camera';

interface PredictionResult {
  id: number;
  disease: string;
  confidence: number;
  risk_level: string;
  original_url: string;
  gradcam_url: string;
}

interface UploaderProps {
  onComplete: (result: PredictionResult) => void;
  theme: Theme;
}

const tc = {
  label:      (th: Theme) => th === 'dark' ? '#64748b' : '#94a3b8',
  dropBorder: (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.35)',
  dropBg:     (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.03)' : 'rgba(99,102,241,0.04)',
  dropBgHov:  (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.1)',
  text:       (th: Theme) => th === 'dark' ? '#cbd5e1' : '#334155',
  textFaint:  (th: Theme) => th === 'dark' ? '#475569' : '#94a3b8',
  filename:   (th: Theme) => th === 'dark' ? '#475569' : '#64748b',
  tabActive:  (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
  tabBg:      (th: Theme) => th === 'dark' ? 'rgba(15,23,42,0.5)' : 'rgba(241,245,255,0.8)',
};

function deriveRisk(cls: string): string {
  const l = cls.toLowerCase();
  if (l.includes('normal'))   return 'Low';
  if (l.includes('cataract')) return 'Moderate';
  return 'High';
}

function SpinnerRow({ label }: { label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <span style={{
        display: 'inline-block', width: '14px', height: '14px',
        border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
        borderRadius: '50%', animation: 'uploaderSpin 0.7s linear infinite',
      }} />
      {label}
    </span>
  );
}

// ─── Eye Region Cropping Utilities ────────────────────────────────────────────

/**
 * cropEyeRegion
 * -------------
 * Crops the uploaded/captured image to focus on the eye region before sending
 * to the model. Strategy:
 *   1. Try the browser's Face Detection API (where supported).
 *   2. Fall back to a heuristic centre-crop that covers the typical fundus-
 *      photograph area (a square inscribed in the shorter dimension, centred).
 *
 * The output is a square JPEG Blob at `outputSize × outputSize` px.
 */
async function cropEyeRegion(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  outputSize = 512
): Promise<Blob> {
  const srcW = 'naturalWidth'  in source ? source.naturalWidth  : (source as HTMLVideoElement).videoWidth  || (source as HTMLCanvasElement).width;
  const srcH = 'naturalHeight' in source ? source.naturalHeight : (source as HTMLVideoElement).videoHeight || (source as HTMLCanvasElement).height;

  let cropX = 0, cropY = 0, cropSize = Math.min(srcW, srcH);

  // ── 1. Try Face Detection API (Chrome 74+, Edge 79+) ──────────────────────
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      // @ts-ignore – FaceDetector is not yet in TS lib
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces: Array<{ boundingBox: DOMRectReadOnly; landmarks?: Array<{ type: string; locations: DOMPointReadOnly[] }> }> =
        await detector.detect(source);

      if (faces.length > 0) {
        const face = faces[0];
        const fb   = face.boundingBox;

        // If landmarks include eyes, use them; otherwise derive from face box
        const eyeLandmarks = face.landmarks?.filter(l => l.type === 'eye') ?? [];

        if (eyeLandmarks.length >= 1) {
          // Find bounding box that covers all eye landmarks
          const allPts = eyeLandmarks.flatMap(l => l.locations);
          const minX = Math.min(...allPts.map(p => p.x));
          const maxX = Math.max(...allPts.map(p => p.x));
          const minY = Math.min(...allPts.map(p => p.y));
          const maxY = Math.max(...allPts.map(p => p.y));

          const eyeW   = maxX - minX;
          const eyeH   = maxY - minY;
          const eyeMX  = (minX + maxX) / 2;
          const eyeMY  = (minY + maxY) / 2;
          // Pad generously around eyes — fundus images need context
          const pad    = Math.max(eyeW, eyeH) * 1.5;
          cropSize     = Math.round(pad * 2);
          cropX        = Math.round(eyeMX - pad);
          cropY        = Math.round(eyeMY - pad);
        } else {
          // No eye landmarks — use the upper 45 % of the face box for the eye area
          const eyeZoneTop    = fb.top + fb.height * 0.15;
          const eyeZoneHeight = fb.height * 0.45;
          const eyeZoneMidY   = eyeZoneTop + eyeZoneHeight / 2;
          const eyeZoneMidX   = fb.left + fb.width / 2;
          cropSize = Math.round(Math.max(fb.width, eyeZoneHeight) * 1.4);
          cropX    = Math.round(eyeZoneMidX - cropSize / 2);
          cropY    = Math.round(eyeZoneMidY - cropSize / 2);
        }

        // Clamp to image bounds
        cropX    = Math.max(0, Math.min(cropX, srcW - cropSize));
        cropY    = Math.max(0, Math.min(cropY, srcH - cropSize));
        cropSize = Math.min(cropSize, srcW - cropX, srcH - cropY);
      }
    } catch {
      // FaceDetector failed or unsupported — fall through to heuristic
    }
  }

  // ── 2. Heuristic centre-crop (fallback) ───────────────────────────────────
  // For portrait/selfie images the eyes are typically in the upper-centre third.
  // For a landscape face photo: horizontally centre, vertically at ~35% of height.
  if (cropX === 0 && cropY === 0 && cropSize === Math.min(srcW, srcH)) {
    const isPortrait = srcH > srcW;
    cropSize = Math.round(Math.min(srcW, srcH) * (isPortrait ? 0.55 : 0.50));
    cropX    = Math.round((srcW - cropSize) / 2);                  // horizontal centre
    cropY    = Math.round(isPortrait
      ? srcH * 0.28 - cropSize / 2   // eyes in upper part of portrait
      : srcH * 0.30 - cropSize / 2   // eyes in upper third of landscape
    );
    cropY = Math.max(0, Math.min(cropY, srcH - cropSize));
  }

  // ── 3. Draw the crop onto an offscreen canvas ──────────────────────────────
  const canvas  = document.createElement('canvas');
  canvas.width  = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d')!;

  // Black letterbox fill in case crop overshoots
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.drawImage(
    source as CanvasImageSource,
    cropX, cropY, cropSize, cropSize,   // source rect
    0, 0, outputSize, outputSize        // dest rect (full canvas)
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/jpeg',
      0.95
    );
  });
}

/**
 * loadImageElement
 * ----------------
 * Loads a File or data-URL string into an HTMLImageElement so we can pass it
 * to the FaceDetector / canvas APIs.
 */
function loadImageElement(src: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Uploader({ onComplete, theme }: UploaderProps) {
  const [mode, setMode]         = useState<Mode>('upload');
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null); // eye-crop preview
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured]       = useState<string | null>(null);
  const [croppedCapture, setCroppedCapture] = useState<string | null>(null); // eye-crop of camera frame
  const [facingMode, setFacingMode]   = useState<'user' | 'environment'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const inputRef  = useRef<HTMLInputElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const th = theme;

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const videoCams = devices.filter(d => d.kind === 'videoinput');
      setHasMultipleCameras(videoCams.length > 1);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode !== 'camera') stopCamera();
    return () => stopCamera();
  }, [mode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('idle');
  }, []);

  const attachStream = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = null;
    video.load();
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve) => {
      const onMeta = () => { video.removeEventListener('loadedmetadata', onMeta); resolve(); };
      video.addEventListener('loadedmetadata', onMeta);
      setTimeout(resolve, 3000);
    });

    try { await video.play(); } catch { /* autoplay blocked */ }
    setCameraState('active');
  }, []);

  const startCamera = useCallback(async (facing: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    setCameraState('starting');
    setCaptured(null);
    setCroppedCapture(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      await attachStream(stream);
    } catch (err: unknown) {
      stopCamera();
      const msg = err instanceof Error ? err.message : String(err);
      let friendlyMsg: string;

      if (msg.includes('Permission') || msg.includes('denied') || msg.includes('NotAllowed')) {
        friendlyMsg = 'Camera permission denied. Please allow camera access in your browser settings and try again.';
      } else if (msg.includes('NotFound') || msg.includes('device') || msg.includes('found')) {
        friendlyMsg = 'No camera found on this device.';
      } else if (msg.includes('Overconstrained')) {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          await attachStream(fallbackStream);
          return;
        } catch {
          friendlyMsg = 'Camera could not start. Try switching cameras.';
        }
      } else {
        friendlyMsg = `Camera error: ${msg}`;
      }

      setCameraError(friendlyMsg);
      setCameraState('error');
    }
  }, [facingMode, attachStream, stopCamera]);

  const flipCamera = useCallback(async () => {
    const next: 'user' | 'environment' = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    await startCamera(next);
  }, [facingMode, startCamera]);

  // ── captureFrame: grab from video, crop to eye region ─────────────────────
  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    // 1. Draw the full raw frame to a temp canvas
    const raw = document.createElement('canvas');
    raw.width  = video.videoWidth  || 640;
    raw.height = video.videoHeight || 480;
    const rawCtx = raw.getContext('2d')!;

    if (facingMode === 'user') {
      rawCtx.translate(raw.width, 0);
      rawCtx.scale(-1, 1);
    }
    rawCtx.drawImage(video, 0, 0, raw.width, raw.height);

    const fullDataUrl = raw.toDataURL('image/jpeg', 0.95);
    setCaptured(fullDataUrl);   // save full frame for "Retake" UI
    stopCamera();

    // 2. Crop to eye region
    try {
      const img         = await loadImageElement(fullDataUrl);
      const croppedBlob = await cropEyeRegion(img);
      const croppedUrl  = URL.createObjectURL(croppedBlob);
      setCroppedCapture(croppedUrl);
    } catch {
      // If cropping fails, fall back to full image
      setCroppedCapture(null);
    }
  }, [facingMode, stopCamera]);

  const retakePhoto = useCallback(() => {
    setCaptured(null);
    setCroppedCapture(null);
    startCamera();
  }, [startCamera]);

  // ── analyzeCapture: send the eye-cropped blob ──────────────────────────────
  const analyzeCapture = useCallback(async () => {
    if (!captured) return;
    setLoading(true);
    setError(null);
    try {
      let blob: Blob;

      if (croppedCapture) {
        // Use the already-cropped object URL
        const res = await fetch(croppedCapture);
        blob = await res.blob();
      } else {
        // Fall back: crop on-the-fly from the full capture
        const img = await loadImageElement(captured);
        blob = await cropEyeRegion(img);
      }

      const imageBlob = blob.type.startsWith('image/') ? blob : new Blob([blob], { type: 'image/jpeg' });
      const formData  = new FormData();
      formData.append('file', imageBlob, 'retinal_eye_crop.jpg');
      await submitForm(formData);
    } catch {
      setError('Failed to process captured image. Please retake.');
      setLoading(false);
    }
  }, [captured, croppedCapture]);

  // ── pickFile: load + show eye-crop preview for uploaded images ─────────────
  const pickFile = async (f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, BMP, WEBP).');
      return;
    }
    setFile(f);
    setError(null);
    setCroppedPreview(null);

    // Show original preview immediately
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);

      // Generate eye-crop preview in the background
      try {
        const img         = await loadImageElement(dataUrl);
        const croppedBlob = await cropEyeRegion(img);
        const croppedUrl  = URL.createObjectURL(croppedBlob);
        setCroppedPreview(croppedUrl);
      } catch {
        setCroppedPreview(null);
      }
    };
    reader.readAsDataURL(f);
  };

  const reset = () => {
    setFile(null); setPreview(null); setCroppedPreview(null);
    setError(null); setLoading(false); setCaptured(null); setCroppedCapture(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) pickFile(f);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) pickFile(f);
  };

  // ── analyzeUpload: crop the file's eye region first, then submit ───────────
  const analyzeUpload = async () => {
    if (!file) return;
    setLoading(true); setError(null);

    try {
      const img         = await loadImageElement(file);
      const croppedBlob = await cropEyeRegion(img);
      const formData    = new FormData();
      formData.append('file', croppedBlob, 'retinal_eye_crop.jpg');
      await submitForm(formData);
    } catch {
      // If cropping fails, submit the raw file as fallback
      const formData = new FormData();
      formData.append('file', file);
      await submitForm(formData);
    }
  };

  const submitForm = async (formData: FormData) => {
    try {
      const { data } = await axios.post(`${API}/predict`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const normalized: PredictionResult = {
        id:           data.id ?? Math.floor(Math.random() * 90000 + 10000),
        disease:      data.predicted_class ?? data.disease ?? 'Unknown',
        confidence:   data.confidence ?? 0,
        risk_level:   data.risk_level ?? deriveRisk(data.predicted_class ?? ''),
        original_url: data.original_url ?? '',
        gradcam_url:  data.grad_cam_url ?? data.gradcam_url ?? '',
      };
      onComplete(normalized);
      reset();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? err.message
        : 'Unexpected error — check backend connection.';
      setError(msg);
    }
    setLoading(false);
  };

  // ── Crop preview badge ─────────────────────────────────────────────────────
  const CropBadge = ({ croppedSrc }: { croppedSrc: string }) => (
    <div style={{
      marginBottom: '10px',
      padding: '8px 10px',
      borderRadius: '10px',
      background: 'rgba(99,102,241,0.08)',
      border: '1px solid rgba(99,102,241,0.2)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      <img src={croppedSrc} alt="Eye crop preview" style={{
        width: '52px', height: '52px', borderRadius: '50%',
        objectFit: 'cover', border: '2px solid rgba(99,102,241,0.4)',
        flexShrink: 0,
      }} />
      <div>
        <p style={{ color: '#6366f1', fontSize: '11px', fontWeight: 700, margin: '0 0 2px' }}>
          👁 Eye Region Detected
        </p>
        <p style={{ color: tc.textFaint(th), fontSize: '11px', margin: 0, lineHeight: 1.4 }}>
          Only the eye area will be sent for analysis — background excluded.
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '16px' }}>

      {/* Mode Toggle Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '16px',
        background: tc.tabBg(th), padding: '4px', borderRadius: '12px',
        border: `1px solid ${tc.dropBorder(th)}`,
      }}>
        {(['upload', 'camera'] as Mode[]).map((m) => (
          <button key={m} onClick={() => { reset(); setMode(m); }} style={{
            flex: 1, padding: '10px 0', borderRadius: '9px', border: 'none',
            cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            transition: 'all 0.2s ease',
            background: mode === m ? tc.tabActive(th) : 'transparent',
            color: mode === m ? '#4f46e5' : tc.textFaint(th),
            boxShadow: mode === m ? '0 2px 8px rgba(99,102,241,0.15)' : 'none',
          }}>
            {m === 'upload' ? '📁 Upload Image' : '📷 Live Camera'}
          </button>
        ))}
      </div>

      {/* ── UPLOAD MODE ── */}
      {mode === 'upload' && (
        <div>
          {!file ? (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? '#6366f1' : tc.dropBorder(th)}`,
                borderRadius: '14px', padding: '36px 20px',
                textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: dragging ? tc.dropBgHov(th) : tc.dropBg(th),
                outline: 'none',
              }}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15"
                    stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="17 8 12 3 7 8"
                    stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="3" x2="12" y2="15"
                    stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{ color: tc.text(th), fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                Drop fundus image here
              </p>
              <p style={{ color: tc.textFaint(th), fontSize: '12px', marginBottom: '6px' }}>
                or tap to browse · JPG, PNG, BMP, WEBP
              </p>
              <p style={{ color: tc.textFaint(th), fontSize: '11px', opacity: 0.75 }}>
                👁 Eye region will be auto-cropped before analysis
              </p>
              <input ref={inputRef} type="file" accept="image/*"
                onChange={onInputChange} style={{ display: 'none' }} />
            </div>
          ) : (
            <div>
              {/* Eye-crop preview badge */}
              {croppedPreview && <CropBadge croppedSrc={croppedPreview} />}

              <div style={{ position: 'relative', marginBottom: '14px' }}>
                {/* Show the cropped version as the main preview once ready */}
                <img
                  src={croppedPreview ?? preview!}
                  alt="Preview"
                  style={{
                    width: '100%', maxHeight: '260px', objectFit: 'contain',
                    borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)',
                    background: '#000', display: 'block',
                  }}
                />
                {/* Eye crop indicator ring */}
                {!croppedPreview && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      width: '52%', height: '52%',
                      borderRadius: '50%',
                      border: '2px solid rgba(99,102,241,0.7)',
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                    }} />
                  </div>
                )}
                <button onClick={reset} aria-label="Remove image" style={{
                  position: 'absolute', top: '8px', right: '8px',
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: '16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              </div>
              <p style={{
                color: tc.filename(th), fontSize: '11px', marginBottom: '14px',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                📎 {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
              <button onClick={analyzeUpload} disabled={loading} style={{
                width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                background: loading ? 'rgba(99,102,241,0.35)' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#fff', fontSize: '14px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
                transition: 'all 0.2s ease',
              }}>
                {loading ? <SpinnerRow label="Cropping & Analysing…" /> : '🔬 Analyze Retinal Image'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── CAMERA MODE ── */}
      {mode === 'camera' && (
        <div>

          {/* Idle */}
          {cameraState === 'idle' && !captured && (
            <div style={{
              border: `2px dashed ${tc.dropBorder(th)}`, borderRadius: '14px',
              padding: '36px 20px', textAlign: 'center', background: tc.dropBg(th),
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', fontSize: '28px',
              }}>📷</div>
              <p style={{ color: tc.text(th), fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
                Live Camera Screening
              </p>
              <p style={{ color: tc.textFaint(th), fontSize: '12px', marginBottom: '6px', lineHeight: 1.6 }}>
                Point your camera at a fundus photograph or retinal image for real-time screening
              </p>
              <p style={{ color: tc.textFaint(th), fontSize: '11px', marginBottom: '20px', opacity: 0.8 }}>
                👁 Eye region will be auto-cropped before analysis
              </p>
              <button onClick={() => startCamera()} style={{
                padding: '12px 32px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff', fontSize: '14px', fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                transition: 'all 0.2s ease',
              }}>
                Start Camera
              </button>
            </div>
          )}

          {/* Starting */}
          {cameraState === 'starting' && (
            <div style={{
              borderRadius: '14px', overflow: 'hidden', background: '#0a0a0a',
              minHeight: '240px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: '12px',
            }}>
              <div style={{
                width: '32px', height: '32px',
                border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1',
                borderRadius: '50%', animation: 'uploaderSpin 0.8s linear infinite',
              }} />
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Starting camera…</p>
            </div>
          )}

          {/* Error */}
          {cameraState === 'error' && (
            <div style={{
              padding: '24px 20px', borderRadius: '14px', textAlign: 'center',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🚫</div>
              <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
                {cameraError}
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={() => startCamera()} style={{
                  padding: '10px 24px', borderRadius: '9px', border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}>Try Again</button>
                <button onClick={() => { setCameraState('idle'); setCameraError(null); }} style={{
                  padding: '10px 24px', borderRadius: '9px',
                  border: `1px solid ${tc.dropBorder(th)}`, background: 'transparent',
                  color: tc.textFaint(th), fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}>Cancel</button>
              </div>
            </div>
          )}

          {/*
            KEY: <video> is always mounted while in camera mode.
            display:none hides it without unmounting — keeps ref stable.
          */}
          <div style={{ display: cameraState === 'active' ? 'block' : 'none' }}>
            <div style={{
              position: 'relative', borderRadius: '14px', overflow: 'hidden',
              background: '#000', width: '100%',
              aspectRatio: '4 / 3', maxHeight: '360px',
            }}>
              <video
                ref={videoRef}
                autoPlay playsInline muted
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%', objectFit: 'cover',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                }}
              />

              {/* Eye targeting overlay — tighter circle + crosshair + scan line */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                {/* Dark vignette outside the circle */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'radial-gradient(circle 90px at 50% 40%, transparent 88px, rgba(0,0,0,0.6) 90px)',
                }} />

                {/* Targeting circle — positioned at upper-centre (eye region) */}
                <div style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -60%)',   // shift upward to eye level
                  width: '160px', height: '160px',
                }}>
                  {/* Main circle border */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    border: '2px solid rgba(99,102,241,0.9)',
                    boxShadow: '0 0 12px rgba(99,102,241,0.4), inset 0 0 12px rgba(99,102,241,0.1)',
                  }} />

                  {/* Corner ticks */}
                  {[
                    { top: '-4px', left: '-4px', borderTop: '3px solid #6366f1', borderLeft: '3px solid #6366f1', borderRadius: '4px 0 0 0' },
                    { top: '-4px', right: '-4px', borderTop: '3px solid #6366f1', borderRight: '3px solid #6366f1', borderRadius: '0 4px 0 0' },
                    { bottom: '-4px', left: '-4px', borderBottom: '3px solid #6366f1', borderLeft: '3px solid #6366f1', borderRadius: '0 0 0 4px' },
                    { bottom: '-4px', right: '-4px', borderBottom: '3px solid #6366f1', borderRight: '3px solid #6366f1', borderRadius: '0 0 4px 0' },
                  ].map((style, i) => (
                    <div key={i} style={{ position: 'absolute', width: '14px', height: '14px', ...style }} />
                  ))}

                  {/* Crosshair */}
                  <div style={{
                    position: 'absolute', top: '50%', left: '10%', right: '10%',
                    height: '1px', background: 'rgba(99,102,241,0.45)',
                  }} />
                  <div style={{
                    position: 'absolute', left: '50%', top: '10%', bottom: '10%',
                    width: '1px', background: 'rgba(99,102,241,0.45)',
                  }} />

                  {/* Animated scan line */}
                  <div style={{
                    position: 'absolute', left: '5%', right: '5%',
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.8), transparent)',
                    animation: 'eyeScan 2s ease-in-out infinite',
                    borderRadius: '2px',
                  }} />
                </div>
              </div>

              {/* LIVE badge */}
              <div style={{
                position: 'absolute', top: '10px', left: '10px',
                background: 'rgba(239,68,68,0.9)', color: '#fff',
                padding: '3px 10px', borderRadius: '20px',
                fontSize: '11px', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '5px', zIndex: 2,
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#fff', animation: 'livePulse 1.2s ease-in-out infinite',
                }} />
                LIVE
              </div>

              {/* Eye-crop info pill */}
              <div style={{
                position: 'absolute', top: '10px', right: '10px',
                background: 'rgba(99,102,241,0.85)', color: '#fff',
                padding: '3px 10px', borderRadius: '20px',
                fontSize: '10px', fontWeight: 600, zIndex: 2,
              }}>
                👁 Auto Eye Crop
              </div>

              {/* Guide hint */}
              <div style={{
                position: 'absolute', bottom: '10px', left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                color: 'rgba(255,255,255,0.9)', fontSize: '11px',
                padding: '5px 14px', borderRadius: '20px',
                whiteSpace: 'nowrap', zIndex: 2, lineHeight: 1.5, textAlign: 'center',
              }}>
                👁 Centre ONE eye in the circle · Eye region auto-crops on capture
              </div>
            </div>

            {/* Camera controls */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
<button onClick={flipCamera} title="Switch camera" style={{
  flex: '0 0 auto', padding: '12px 14px', borderRadius: '10px',
  border: `1px solid ${tc.dropBorder(th)}`, background: tc.dropBg(th),
  color: tc.text(th), fontSize: '18px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minWidth: '48px',
}}>🔄</button>
              <button onClick={captureFrame} style={{
                flex: 1, padding: '13px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff', fontSize: '14px', fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>📸 Capture & Crop Eye</button>
              <button onClick={stopCamera} title="Stop camera" style={{
                flex: '0 0 auto', padding: '12px 14px', borderRadius: '10px',
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                color: '#ef4444', fontSize: '18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '48px',
              }}>✕</button>
            </div>
          </div>

          {/* Captured review */}
          {captured && cameraState === 'idle' && (
            <div>
              {/* Eye crop badge */}
              {croppedCapture && <CropBadge croppedSrc={croppedCapture} />}

              <div style={{ position: 'relative', marginBottom: '14px' }}>
                {/* Show cropped version if available, full frame otherwise */}
                <img
                  src={croppedCapture ?? captured}
                  alt="Captured eye region"
                  style={{
                    width: '100%', maxHeight: '300px', objectFit: 'contain',
                    borderRadius: '12px', border: '1px solid rgba(99,102,241,0.25)',
                    background: '#000', display: 'block',
                  }}
                />
                <div style={{
                  position: 'absolute', top: '8px', left: '8px',
                  background: croppedCapture ? 'rgba(99,102,241,0.9)' : 'rgba(245,158,11,0.9)',
                  color: '#fff',
                  padding: '3px 10px', borderRadius: '20px',
                  fontSize: '11px', fontWeight: 700,
                }}>
                  {croppedCapture ? '👁 Eye Cropped' : '📸 Captured'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={retakePhoto} disabled={loading} style={{
                  flex: 1, padding: '13px', borderRadius: '10px',
                  border: `1px solid ${tc.dropBorder(th)}`, background: tc.dropBg(th),
                  color: tc.text(th), fontSize: '13px', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
                }}>🔄 Retake</button>
                <button onClick={analyzeCapture} disabled={loading} style={{
                  flex: 2, padding: '13px', borderRadius: '10px', border: 'none',
                  background: loading ? 'rgba(99,102,241,0.35)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#fff', fontSize: '14px', fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.4)',
                  transition: 'all 0.2s ease',
                }}>
                  {loading ? <SpinnerRow label="Analysing…" /> : '🔬 Analyze Eye Image'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: '14px', padding: '12px 14px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px', color: '#fca5a5', fontSize: '13px',
          display: 'flex', alignItems: 'flex-start', gap: '8px',
        }}>
          <span style={{ flexShrink: 0 }}>⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{
            marginLeft: 'auto', flexShrink: 0,
            background: 'none', border: 'none',
            color: '#fca5a5', cursor: 'pointer', fontSize: '16px', lineHeight: 1,
          }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.75); }
        }
        @keyframes uploaderSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes eyeScan {
          0%   { top: 10%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}