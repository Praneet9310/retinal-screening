'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

type Theme = 'dark' | 'light';

interface LiveResult {
  disease: string;
  confidence: number;
  risk_level: string;
}

interface Props {
  theme: Theme;
  onClose: () => void;
  onComplete?: () => void | Promise<void>;
}

const tc = {
  card:    (th: Theme) => th === 'dark' ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)',
  border:  (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.25)',
  text:    (th: Theme) => th === 'dark' ? '#f1f5f9' : '#0f172a',
  muted:   (th: Theme) => th === 'dark' ? '#94a3b8' : '#64748b',
  faint:   (th: Theme) => th === 'dark' ? '#475569' : '#94a3b8',
};

const riskColor = (r: string) => r === 'High' ? '#f87171' : r === 'Moderate' ? '#fbbf24' : '#34d399';
const riskBg    = (r: string) => r === 'High' ? 'rgba(248,113,113,0.15)' : r === 'Moderate' ? 'rgba(251,191,36,0.15)' : 'rgba(52,211,153,0.15)';

export default function LiveMonitor({ theme, onClose, onComplete }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const overlayRef  = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status,   setStatus]   = useState<'requesting' | 'active' | 'denied' | 'nosupport'>('requesting');
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [result,   setResult]   = useState<LiveResult | null>(null);
  const [frameN,   setFrameN]   = useState(0);
  const [elapsed,  setElapsed]  = useState(0);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Start camera
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('nosupport'); return; }
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStatus('active');
      })
      .catch(() => setStatus('denied'));

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Overlay animation loop
  useEffect(() => {
    if (status !== 'active') return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    let animId: number;
    let t = 0;

    const draw = () => {
      overlay.width  = overlay.offsetWidth;
      overlay.height = overlay.offsetHeight;
      const W = overlay.width;
      const H = overlay.height;
      ctx.clearRect(0, 0, W, H);
      t += 0.02;

      // Corner brackets
      const size = 28;
      const thick = 3;
      const corners: [number, number][] = [[0, 0], [W, 0], [W, H], [0, H]];
      const dirs: [number, number][]    = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

      ctx.strokeStyle = scanning ? 'rgba(99,102,241,0.9)' : 'rgba(99,102,241,0.55)';
      ctx.lineWidth   = thick;
      ctx.lineCap     = 'round';

      corners.forEach(([cx2, cy2], i) => {
        const [dx, dy] = dirs[i];
        ctx.beginPath(); ctx.moveTo(cx2 + dx * 4, cy2); ctx.lineTo(cx2 + dx * (size + 4), cy2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx2, cy2 + dy * 4); ctx.lineTo(cx2, cy2 + dy * (size + 4)); ctx.stroke();
      });

      // Scan line
      if (scanning) {
        const y = ((Math.sin(t * 1.5) + 1) / 2) * H;
        const sg = ctx.createLinearGradient(0, y - 12, 0, y + 12);
        sg.addColorStop(0,   'rgba(99,102,241,0)');
        sg.addColorStop(0.5, 'rgba(99,102,241,0.7)');
        sg.addColorStop(1,   'rgba(99,102,241,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, y - 12, W, 24);
        ctx.strokeStyle = 'rgba(139,92,246,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Center crosshair
      ctx.strokeStyle = 'rgba(99,102,241,0.25)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.moveTo(W / 2 - 30, H / 2); ctx.lineTo(W / 2 + 30, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W / 2, H / 2 - 30); ctx.lineTo(W / 2, H / 2 + 30); ctx.stroke();
      ctx.setLineDash([]);

      // Center pulse ring
      const pr = 30 + Math.sin(t * 2) * 4;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, pr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(99,102,241,${0.15 + Math.sin(t * 2) * 0.1})`;
      ctx.lineWidth   = 1;
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [status, scanning]);

  // Elapsed timer
  useEffect(() => {
    if (status !== 'active') return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Frame counter
  useEffect(() => {
    if (status !== 'active') return;
    const id = setInterval(() => setFrameN(f => f + 1), 33);
    return () => clearInterval(id);
  }, [status]);

  const captureAndAnalyze = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    setScanning(true);
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) { setScanning(false); return; }
      const fd = new FormData();
      fd.append('file', blob, 'frame.jpg');
      try {
        const { data } = await axios.post(`${API}/predict`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setResult({
          disease:    data.predicted_class ?? data.disease ?? 'Unknown',
          confidence: data.confidence ?? 0,
          risk_level: data.risk_level ?? deriveRisk(data.predicted_class ?? ''),
        });
        onComplete?.();
      } catch {
        setResult({ disease: 'Backend offline', confidence: 0, risk_level: 'Unknown' });
      } finally {
        setScanning(false);
      }
    }, 'image/jpeg', 0.8);
  }, [API]);

  // Auto-scan interval
  useEffect(() => {
    if (autoScan && status === 'active') {
      intervalRef.current = setInterval(captureAndAnalyze, 4000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoScan, status, captureAndAnalyze]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', animation: 'fadeIn 0.25s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: '900px',
        background: tc.card(theme), border: `1px solid ${tc.border(theme)}`,
        borderRadius: '24px', overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 28px', borderBottom: `1px solid ${tc.border(theme)}`,
          background: theme === 'dark' ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: status === 'active' ? '#34d399' : '#f87171',
              boxShadow: status === 'active' ? '0 0 10px #34d399' : '0 0 10px #f87171',
              animation: status === 'active' ? 'orbPulse 2s infinite' : 'none',
            }} />
            <span style={{ fontWeight: 700, fontSize: '16px', color: tc.text(theme) }}>
              Live Retinal Monitor
            </span>
            {status === 'active' && (
              <span style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                background: 'rgba(52,211,153,0.1)', color: '#34d399',
                border: '1px solid rgba(52,211,153,0.25)',
              }}>● LIVE</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {status === 'active' && (
              <span style={{ fontSize: '12px', color: tc.muted(theme), fontFamily: 'monospace' }}>
                {fmt(elapsed)} · F{frameN}
              </span>
            )}
            <button onClick={onClose} style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: `1px solid ${tc.border(theme)}`,
              background: 'transparent', color: tc.muted(theme),
              cursor: 'pointer', fontSize: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px' }}>

          {/* Video panel */}
          <div style={{ padding: '24px', paddingRight: '12px' }}>
            {status === 'requesting' && (
              <div style={{
                aspectRatio: '4/3', borderRadius: '16px', background: 'rgba(99,102,241,0.06)',
                border: `2px dashed ${tc.border(theme)}`, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '16px',
              }}>
                <div style={{ fontSize: '48px' }}>📷</div>
                <p style={{ color: tc.muted(theme), fontWeight: 600 }}>Requesting camera access…</p>
                <p style={{ color: tc.faint(theme), fontSize: '13px', textAlign: 'center', maxWidth: '280px' }}>
                  Allow camera access in your browser to enable live retinal monitoring
                </p>
              </div>
            )}
            {status === 'denied' && (
              <div style={{
                aspectRatio: '4/3', borderRadius: '16px', background: 'rgba(239,68,68,0.06)',
                border: '2px dashed rgba(239,68,68,0.3)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '12px',
              }}>
                <div style={{ fontSize: '48px' }}>🚫</div>
                <p style={{ color: '#f87171', fontWeight: 600 }}>Camera access denied</p>
                <p style={{ color: tc.faint(theme), fontSize: '13px', textAlign: 'center', maxWidth: '260px' }}>
                  Enable camera permissions in browser settings and refresh
                </p>
              </div>
            )}
            {status === 'nosupport' && (
              <div style={{
                aspectRatio: '4/3', borderRadius: '16px', background: 'rgba(245,158,11,0.06)',
                border: '2px dashed rgba(245,158,11,0.3)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '12px',
              }}>
                <div style={{ fontSize: '48px' }}>⚠️</div>
                <p style={{ color: '#fbbf24', fontWeight: 600 }}>Camera not supported</p>
                <p style={{ color: tc.faint(theme), fontSize: '13px', textAlign: 'center' }}>
                  Use a modern browser (Chrome, Edge, Firefox)
                </p>
              </div>
            )}
            {status === 'active' && (
              <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#000' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }}
                />
                <canvas ref={overlayRef} style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                }} />
                {scanning && (
                  <div style={{
                    position: 'absolute', top: '12px', left: '12px',
                    padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                    background: 'rgba(99,102,241,0.85)', color: '#fff',
                    animation: 'scanPulse 0.8s ease infinite alternate',
                  }}>⬡ SCANNING</div>
                )}
              </div>
            )}

            {/* Hidden capture canvas */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Controls */}
            {status === 'active' && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={captureAndAnalyze} disabled={scanning} style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                  background: scanning
                    ? 'rgba(99,102,241,0.35)'
                    : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: '#fff', fontWeight: 700, fontSize: '14px',
                  cursor: scanning ? 'not-allowed' : 'pointer',
                  boxShadow: scanning ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                }}>
                  {scanning ? '⏳ Scanning…' : '📸 Capture & Analyze'}
                </button>
                <button onClick={() => setAutoScan(a => !a)} style={{
                  padding: '12px 16px', borderRadius: '12px',
                  border: `1px solid ${autoScan ? 'rgba(52,211,153,0.4)' : tc.border(theme)}`,
                  background: autoScan ? 'rgba(52,211,153,0.12)' : 'transparent',
                  color: autoScan ? '#34d399' : tc.muted(theme),
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  {autoScan ? '⏸ Auto: ON' : '▶ Auto: OFF'}
                </button>
              </div>
            )}
          </div>

          {/* Results panel */}
          <div style={{
            padding: '24px', borderLeft: `1px solid ${tc.border(theme)}`,
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <p style={{
              fontSize: '11px', fontWeight: 700, color: tc.faint(theme),
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              Live Analysis
            </p>

            {result ? (
              <>
                {/* Disease */}
                <div style={{
                  padding: '16px', borderRadius: '14px',
                  background: riskBg(result.risk_level),
                  border: `1px solid ${riskColor(result.risk_level)}33`,
                }}>
                  <p style={{
                    fontSize: '11px', color: tc.faint(theme), marginBottom: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>Detected</p>
                  <p style={{ fontSize: '20px', fontWeight: 900, color: tc.text(theme), marginBottom: '8px' }}>
                    {result.disease}
                  </p>
                  <span style={{
                    padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                    background: riskBg(result.risk_level), color: riskColor(result.risk_level),
                    border: `1px solid ${riskColor(result.risk_level)}44`,
                  }}>● {result.risk_level} Risk</span>
                </div>

                {/* Confidence */}
                <div style={{
                  padding: '16px', borderRadius: '14px',
                  background: theme === 'dark' ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)',
                  border: `1px solid ${tc.border(theme)}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', color: tc.muted(theme), fontWeight: 600 }}>Confidence</span>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: '#60a5fa' }}>
                      {(result.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{
                    height: '6px', borderRadius: '3px',
                    background: 'rgba(99,102,241,0.15)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: '3px',
                      width: `${result.confidence * 100}%`,
                      background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>

                {/* Advice */}
                <div style={{
                  padding: '14px', borderRadius: '12px',
                  background: theme === 'dark' ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,252,0.8)',
                  border: `1px solid ${tc.border(theme)}`,
                }}>
                  <p style={{
                    fontSize: '11px', color: tc.faint(theme), marginBottom: '6px',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    Recommendation
                  </p>
                  <p style={{ fontSize: '12px', color: tc.muted(theme), lineHeight: 1.5 }}>
                    {result.risk_level === 'High'
                      ? 'Consult an ophthalmologist immediately. Signs of serious retinal disease detected.'
                      : result.risk_level === 'Moderate'
                      ? 'Schedule a follow-up exam within 30 days. Monitor for changes.'
                      : 'Retina appears healthy. Continue regular annual screenings.'}
                  </p>
                </div>

                <p style={{ fontSize: '11px', color: tc.faint(theme), textAlign: 'center' }}>
                  {autoScan ? '🔄 Auto-scanning every 4s' : 'Press capture for a new scan'}
                </p>
              </>
            ) : (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '12px', padding: '20px',
                borderRadius: '14px', border: `1px dashed ${tc.border(theme)}`,
                background: theme === 'dark' ? 'rgba(99,102,241,0.03)' : 'rgba(99,102,241,0.02)',
              }}>
                <div style={{ fontSize: '40px' }}>👁️</div>
                <p style={{ color: tc.muted(theme), fontWeight: 600, textAlign: 'center', fontSize: '14px' }}>
                  {status === 'active' ? 'Capture a frame to analyze' : 'Waiting for camera…'}
                </p>
                <p style={{ color: tc.faint(theme), fontSize: '12px', textAlign: 'center' }}>
                  AI will classify retinal conditions in real-time
                </p>
              </div>
            )}

            {/* Disclaimer */}
            <p style={{ fontSize: '10px', color: tc.faint(theme), textAlign: 'center', lineHeight: 1.4 }}>
              ⚠️ For research use only. Not a clinical diagnostic tool.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scanPulse { from { opacity: 1; } to { opacity: 0.5; } }
        @keyframes fadeIn    { from { opacity: 0; } to { opacity: 1; } }
        @keyframes orbPulse  { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.85); } }
      `}</style>
    </div>
  );
}

function deriveRisk(cls: string): string {
  const l = cls.toLowerCase();
  if (l.includes('normal'))   return 'Low';
  if (l.includes('cataract')) return 'Moderate';
  return 'High';
}


