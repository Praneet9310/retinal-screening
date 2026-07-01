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
  onScanComplete?: () => void;
  onOpenLiveCamera?: () => void;
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

// ─── Targeting-circle constants ───────────────────────────────────────────────
const CIRCLE_RATIO    = 0.30;
const CIRCLE_DIAM_PCT = CIRCLE_RATIO * 100;
const VIGNETTE_RX_PCT = CIRCLE_RATIO * 50;
const VIGNETTE_RY_PCT = CIRCLE_RATIO * 50 * (4 / 3);
const VIGNETTE_CY_PCT = (0.5 - 0.10 * CIRCLE_RATIO) * 100;

function cropCameraFrame(rawCanvas: HTMLCanvasElement, outputSize = 512): Promise<Blob> {
  const srcW = rawCanvas.width;
  const srcH = rawCanvas.height;

  const CONTAINER_ASPECT = 4 / 3;
  const rawAspect = srcW / srcH;
  let visibleW: number, visibleH: number, offsetX: number, offsetY: number;

  if (rawAspect > CONTAINER_ASPECT) {
    visibleH = srcH;
    visibleW = srcH * CONTAINER_ASPECT;
    offsetX  = (srcW - visibleW) / 2;
    offsetY  = 0;
  } else {
    visibleW = srcW;
    visibleH = srcW / CONTAINER_ASPECT;
    offsetX  = 0;
    offsetY  = (srcH - visibleH) / 2;
  }

  const circleDiam = CIRCLE_RATIO * visibleW;
  const centreX    = offsetX + 0.5 * visibleW;
  const centreY    = offsetY + 0.5 * visibleH - 0.10 * circleDiam;

  const cropSize = Math.round(circleDiam);
  const cropX = Math.max(0, Math.min(Math.round(centreX - cropSize / 2), srcW - cropSize));
  const cropY = Math.max(0, Math.min(Math.round(centreY - cropSize / 2), srcH - cropSize));

  const out = document.createElement('canvas');
  out.width  = outputSize;
  out.height = outputSize;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.drawImage(rawCanvas, cropX, cropY, cropSize, cropSize, 0, 0, outputSize, outputSize);

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/jpeg', 0.95
    );
  });
}

function loadImageElement(src: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Uploader({ onComplete, theme, onScanComplete, onOpenLiveCamera }: UploaderProps) {
  const [mode, setMode]         = useState<Mode>('upload');
  const [dragging, setDragging] = useState(false);
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured]             = useState<string | null>(null);
  const [croppedCapture, setCroppedCapture] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob]       = useState<Blob | null>(null);
  const [facingMode, setFacingMode]         = useState<'user' | 'environment'>('environment');
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
    setCroppedBlob(null);
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

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
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
    setCaptured(fullDataUrl);
    stopCamera();
    try {
      const blob       = await cropCameraFrame(raw);
      const croppedUrl = URL.createObjectURL(blob);
      setCroppedCapture(croppedUrl);
      setCroppedBlob(blob);
    } catch {
      setCroppedCapture(null);
      setCroppedBlob(null);
    }
  }, [facingMode, stopCamera]);

  const retakePhoto = useCallback(() => {
    setCaptured(null);
    setCroppedCapture(null);
    setCroppedBlob(null);
    startCamera();
  }, [startCamera]);

  const analyzeCapture = useCallback(async () => {
    if (!captured) return;
    setLoading(true);
    setError(null);
    try {
      let blob: Blob;
      if (croppedBlob) {
        blob = croppedBlob;
      } else {
        const img = await loadImageElement(captured);
        const raw = document.createElement('canvas');
        raw.width  = img.naturalWidth;
        raw.height = img.naturalHeight;
        raw.getContext('2d')!.drawImage(img, 0, 0);
        blob = await cropCameraFrame(raw);
      }
      const formData = new FormData();
      formData.append('file', blob, 'retinal_circle_crop.jpg');
      await submitForm(formData);
    } catch {
      setError('Failed to process captured image. Please retake.');
      setLoading(false);
    }
  }, [captured, croppedBlob]);

  // ── Upload: show original as-is, send original as-is — no cropping ─────────
  const pickFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, BMP, WEBP).');
      return;
    }
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const reset = () => {
    setFile(null); setPreview(null);
    setError(null); setLoading(false); setCaptured(null);
    setCroppedCapture(null); setCroppedBlob(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) pickFile(f);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) pickFile(f);
  };

  const analyzeUpload = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    const formData = new FormData();
    formData.append('file', file);
    await submitForm(formData);
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
      onScanComplete?.();
      reset();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? err.message
        : 'Unexpected error — check backend connection.';
      setError(msg);
    }
    setLoading(false);
  };

  const CropBadge = ({ croppedSrc, label }: { croppedSrc: string; label: string }) => (
    <div style={{
      marginBottom: '10px', padding: '8px 10px', borderRadius: '10px',
      background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      <img src={croppedSrc} alt="Crop preview" style={{
        width: '52px', height: '52px', borderRadius: '50%',
        objectFit: 'cover', border: '2px solid rgba(99,102,241,0.4)', flexShrink: 0,
      }} />
      <div>
        <p style={{ color: '#6366f1', fontSize: '11px', fontWeight: 700, margin: '0 0 2px' }}>
          🎯 {label}
        </p>
        <p style={{ color: tc.textFaint(th), fontSize: '11px', margin: 0, lineHeight: 1.4 }}>
          Only this region will be sent for analysis.
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
        {(['upload', 'camera'] as Mode[]).map((m) => {
          const isCamera = m === 'camera';
          return (
            <button
              key={m}
              onClick={() => {
                if (isCamera) {
                  onOpenLiveCamera?.();
                } else {
                  reset();
                  setMode(m);
                }
              }}
              title={isCamera ? 'Opens live camera screening' : undefined}
              style={{
                flex: 1, padding: '10px 0', borderRadius: '9px', border: 'none',
                cursor: 'pointer',
                fontSize: '13px', fontWeight: '600',
                transition: 'all 0.2s ease',
                background: mode === m ? tc.tabActive(th) : 'transparent',
                color: mode === m ? '#4f46e5' : tc.textFaint(th),
                boxShadow: mode === m ? '0 2px 8px rgba(99,102,241,0.15)' : 'none',
                position: 'relative' as const,
              }}
            >
              {m === 'upload' ? '📁 Upload Image' : '📷 Live Camera'}
            </button>
          );
        })}
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
              <input ref={inputRef} type="file" accept="image/*"
                onChange={onInputChange} style={{ display: 'none' }} />
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <img
                  src={preview!}
                  alt="Preview"
                  style={{
                    width: '100%', maxHeight: '260px', objectFit: 'contain',
                    borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)',
                    background: '#000', display: 'block',
                  }}
                />
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
                background: loading
                  ? 'rgba(99,102,241,0.35)'
                  : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#fff', fontSize: '14px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
                transition: 'all 0.2s ease',
              }}>
                {loading ? <SpinnerRow label="Analysing…" /> : '🔬 Analyze Retinal Image'}
              </button>
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