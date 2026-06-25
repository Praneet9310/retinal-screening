'use client';
import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import axios from 'axios';

type Theme = 'dark' | 'light';

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
  label:      (th: Theme) => th === 'dark' ? '#64748b'              : '#94a3b8',
  dropBorder: (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.25)': 'rgba(99,102,241,0.35)',
  dropBg:     (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.03)': 'rgba(99,102,241,0.04)',
  dropBgHov:  (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.08)': 'rgba(99,102,241,0.1)',
  text:       (th: Theme) => th === 'dark' ? '#cbd5e1'              : '#334155',
  textFaint:  (th: Theme) => th === 'dark' ? '#475569'              : '#94a3b8',
  filename:   (th: Theme) => th === 'dark' ? '#475569'              : '#64748b',
};

function deriveRisk(cls: string): string {
  const l = cls.toLowerCase();
  if (l.includes('normal'))   return 'Low';
  if (l.includes('cataract')) return 'Moderate';
  return 'High';
}

export default function Uploader({ onComplete, theme }: UploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const pickFile = (f: File) => {
    if (!f.type.startsWith('image/')) { setError('Please upload a valid image file (JPG, PNG, BMP).'); return; }
    setFile(f); setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const reset = () => {
    setFile(null); setPreview(null); setError(null); setLoading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) pickFile(f);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) pickFile(f);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await axios.post(`${API}/predict`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const normalized: PredictionResult = {
        id:           data.id ?? Math.floor(Math.random() * 90000 + 10000),
        disease:      data.predicted_class ?? data.disease ?? 'Unknown',
        confidence:   data.confidence ?? 0,
        risk_level:   data.risk_level ?? deriveRisk(data.predicted_class ?? ''),
        original_url: data.original_url ?? `/static/uploads/${data.filename}`,
        gradcam_url:  data.grad_cam_url ?? data.gradcam_url ?? '',
      };
      onComplete(normalized);
      reset();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? err.message
        : 'Unexpected error — check backend connection.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <p style={{
        fontSize: '11px', fontWeight: 700, color: tc.label(theme),
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px',
      }}>Upload Retinal Scan</p>

      {/* Drop zone */}
      {!file && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? '#6366f1' : tc.dropBorder(theme)}`,
            borderRadius: '14px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: dragging ? tc.dropBgHov(theme) : tc.dropBg(theme),
          }}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px auto',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15"
                stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ color: tc.text(theme), fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
            Drop fundus image here
          </p>
          <p style={{ color: tc.textFaint(theme), fontSize: '12px' }}>
            or click to browse · JPG, PNG, BMP
          </p>
          <input ref={inputRef} type="file" accept="image/*" onChange={onInputChange} style={{ display: 'none' }} />
        </div>
      )}

      {/* Preview */}
      {file && (
        <div>
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <img src={preview!} alt="Retinal scan preview" style={{
              width: '100%', maxHeight: '220px', objectFit: 'contain',
              borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)',
              background: '#000', display: 'block',
            }} />
            <button onClick={reset} style={{
              position: 'absolute', top: '8px', right: '8px',
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontSize: '16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>×</button>
          </div>
          <p style={{ color: tc.filename(theme), fontSize: '11px', marginBottom: '14px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            📎 {file.name} · {(file.size / 1024).toFixed(1)} KB
          </p>
          <button onClick={analyze} disabled={loading} style={{
            width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
            background: loading ? 'rgba(99,102,241,0.35)' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            color: '#fff', fontSize: '14px', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.02em',
            boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
          }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Spinner /> Analyzing…
              </span>
            ) : '🔬 Analyze Retinal Image'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: '14px', padding: '12px 14px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px', color: '#fca5a5', fontSize: '13px',
        }}>⚠️ {error}</div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: '14px', height: '14px',
      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}