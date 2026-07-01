'use client';
import { useState, useEffect } from 'react';
import AnimatedBackground from '@/components/AnimatedBackground';
import Uploader from '@/components/Uploader';
import LiveMonitor from '@/components/livemonitor';

interface PredictionResult {
  id: number;
  disease: string;
  confidence: number;
  risk_level: string;
  original_url: string;
  gradcam_url: string;
}

export default function Dashboard() {
  const theme = 'light' as const;
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [showLiveMonitor, setShowLiveMonitor] = useState(false);

  const fetchScanCount = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats`);
      const data = await res.json();
      setScanCount(data.total_scans);
    } catch (err) {
      console.error('Failed to fetch scan count', err);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchScanCount();
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleScanComplete = (newResult: PredictionResult) => {
    setResult(newResult);
    fetchScanCount();
  };

  const t = {
    surface: 'rgba(255,255,255,0.85)',
    border: 'rgba(99,102,241,0.15)',
    borderStrong: 'rgba(99,102,241,0.3)',
    text: '#0f172a',
    textMuted: '#64748b',
    textSub: '#475569',
    shadow: '0 4px 24px rgba(99,102,241,0.08)',
    accentLight: 'rgba(99,102,241,0.07)',
    statsHover: '0 8px 28px rgba(99,102,241,0.15)',
  };

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: '100vh',
      color: t.text,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: isMobile ? '16px' : '28px 36px',
      position: 'relative',
      transition: 'color 0.3s ease',
    }}>
      <AnimatedBackground theme="light" />

      <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* ── HEADER ── */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          marginBottom: '28px',
          paddingBottom: '20px',
          borderBottom: `1px solid ${t.border}`,
          gap: '14px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '5px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(79,70,229,0.35)',
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="1.2" strokeDasharray="3 2" />
                  <circle cx="10" cy="10" r="5.5" stroke="white" strokeWidth="0.8" />
                  <circle cx="10" cy="10" r="2.8" fill="white" opacity="0.9" />
                  <circle cx="11.5" cy="8.5" r="1" fill="rgba(79,70,229,0.8)" />
                </svg>
              </div>
              <div>
                <h1 style={{
                  fontSize: isMobile ? '20px' : '26px',
                  fontWeight: '800', margin: 0, lineHeight: 1.1,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em',
                }}>
                  Retinal Diagnostics AI
                </h1>
              </div>
            </div>
            <p style={{
              color: t.textSub, fontSize: '12px', marginLeft: '50px',
            }}>
              Explainable Multi-Class Clinical Decision Support · EfficientNet + Grad-CAM XAI
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              background: t.surface, border: `1px solid ${t.border}`,
              padding: '8px 14px', borderRadius: '10px', fontSize: '13px',
              backdropFilter: 'blur(12px)', boxShadow: t.shadow,
            }}>
              <span style={{ color: '#4f46e5', fontWeight: '700' }}>
                {scanCount != null ? scanCount.toLocaleString() : '—'}
              </span>
              <span style={{ color: t.textMuted }}> scans processed</span>
            </div>
            <div style={{
              background: t.surface, border: '1px solid rgba(34,197,94,0.2)',
              padding: '8px 14px', borderRadius: '10px', fontSize: '13px',
              backdropFilter: 'blur(12px)', boxShadow: t.shadow,
              display: 'flex', alignItems: 'center', gap: '7px',
            }}>
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: '#22c55e', boxShadow: '0 0 8px #22c55e',
                animation: 'livePulse 2s ease-in-out infinite',
              }} />
              <span style={{ color: '#16a34a', fontWeight: '600' }}>System Online</span>
            </div>
          </div>
        </div>

        {/* ── STATS ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: '12px', marginBottom: '24px',
        }}>
          {[
            { label: 'Model Accuracy', value: '94.2%', color: '#4f46e5', icon: '🎯' },
            { label: 'Avg Confidence', value: '91.7%', color: '#7c3aed', icon: '📊' },
            { label: 'Disease Classes', value: '4', color: '#0891b2', icon: '🔬' },
            { label: 'Grad-CAM XAI', value: 'Active', color: '#059669', icon: '⬡' },
          ].map((s) => (
            <div key={s.label} style={{
              background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: '14px', padding: isMobile ? '14px 16px' : '18px 20px',
              backdropFilter: 'blur(12px)', boxShadow: t.shadow,
              transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default',
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLElement).style.boxShadow = t.statsHover;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = t.shadow;
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>{s.icon}</span>
                <span style={{ fontSize: '10px', color: t.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {s.label}
                </span>
              </div>
              <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '340px 1fr',
          gap: '20px', alignItems: 'start',
        }}>

          {/* LEFT — Upload + Classes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Uploader card */}
            <div style={{
              background: t.surface, border: `1px solid ${t.borderStrong}`,
              borderRadius: '18px', overflow: 'hidden',
              backdropFilter: 'blur(12px)', boxShadow: t.shadow,
            }}>
              <Uploader
                onComplete={handleScanComplete}
                theme="light"
                onOpenLiveCamera={() => setShowLiveMonitor(true)}
              />
            </div>

            {/* Disease classes */}
            <div style={{
              background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: '18px', padding: '20px',
              backdropFilter: 'blur(12px)', boxShadow: t.shadow,
            }}>
              <p style={{
                fontSize: '10px', fontWeight: '700', color: t.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px',
              }}>
                Screened Conditions
              </p>
              {[
                { name: 'Normal Retina',        color: '#16a34a', risk: 'Low',      icon: '✓' },
                { name: 'Diabetic Retinopathy',  color: '#d97706', risk: 'High',     icon: '⚠' },
                { name: 'Glaucoma',              color: '#dc2626', risk: 'High',     icon: '⚠' },
                { name: 'Cataract',              color: '#ea580c', risk: 'Moderate', icon: '~' },
              ].map((cls, i, arr) => (
                <div key={cls.name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                      background: `${cls.color}18`, border: `1px solid ${cls.color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: cls.color, fontSize: '12px', fontWeight: '700',
                    }}>
                      {cls.icon}
                    </div>
                    <span style={{ fontSize: '13px', color: t.text, fontWeight: '500' }}>
                      {cls.name}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: '700', padding: '3px 9px',
                    borderRadius: '20px', textTransform: 'uppercase',
                    background: `${cls.color}15`, color: cls.color,
                    border: `1px solid ${cls.color}35`,
                  }}>
                    {cls.risk}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Results */}
          <div>
            {result ? (
              <div style={{
                background: t.surface, border: `1px solid ${t.borderStrong}`,
                borderRadius: '18px', padding: isMobile ? '20px' : '28px',
                backdropFilter: 'blur(12px)', boxShadow: t.shadow,
                animation: 'slideUp 0.35s ease',
              }}>
                {/* Result header */}
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between',
                  gap: '16px', marginBottom: '24px',
                  paddingBottom: '20px',
                  borderBottom: `1px solid ${t.border}`,
                }}>
                  <div>
                    <p style={{
                      fontSize: '10px', color: t.textMuted, textTransform: 'uppercase',
                      letterSpacing: '0.1em', marginBottom: '6px', fontWeight: '600',
                    }}>
                      AI Diagnosis
                    </p>
                    <h2 style={{
                      fontSize: isMobile ? '22px' : '28px', fontWeight: '800',
                      color: t.text, marginBottom: '12px', letterSpacing: '-0.02em',
                    }}>
                      {result.disease}
                    </h2>
                    <span style={{
                      padding: '6px 14px', borderRadius: '8px', fontSize: '12px',
                      fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em',
                      background: result.risk_level === 'High'
                        ? 'rgba(220,38,38,0.1)' : result.risk_level === 'Moderate'
                        ? 'rgba(217,119,6,0.1)' : 'rgba(22,163,74,0.1)',
                      color: result.risk_level === 'High' ? '#dc2626'
                        : result.risk_level === 'Moderate' ? '#d97706' : '#16a34a',
                      border: `1px solid ${result.risk_level === 'High'
                        ? 'rgba(220,38,38,0.25)' : result.risk_level === 'Moderate'
                        ? 'rgba(217,119,6,0.25)' : 'rgba(22,163,74,0.25)'}`,
                    }}>
                      {result.risk_level === 'High' ? '⚠ '
                        : result.risk_level === 'Moderate' ? '~ ' : '✓ '}
                      {result.risk_level} Risk
                    </span>
                  </div>

                  {/* Confidence box */}
                  <div style={{
                    background: t.accentLight, border: `1px solid ${t.border}`,
                    borderRadius: '14px', padding: '16px 24px',
                    textAlign: 'center', flexShrink: 0,
                  }}>
                    <div style={{
                      fontSize: '42px', fontWeight: '900', lineHeight: 1,
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                      {(result.confidence * 100).toFixed(1)}%
                    </div>
                    <div style={{ color: t.textMuted, fontSize: '11px', fontWeight: '600', marginTop: '4px' }}>
                      Confidence Score
                    </div>
                    <div style={{
                      width: '100%', height: '4px', background: t.border,
                      borderRadius: '2px', marginTop: '10px',
                    }}>
                      <div style={{
                        width: `${result.confidence * 100}%`, height: '100%',
                        background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                        borderRadius: '2px', transition: 'width 1s ease',
                      }} />
                    </div>
                  </div>
                </div>

                {/* Scan images */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: '16px', marginBottom: '20px',
                }}>
                  <div>
                    <p style={{
                      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                      letterSpacing: '0.08em', marginBottom: '8px', color: t.textMuted,
                    }}>
                      Original Fundus Scan
                    </p>
                    <div style={{
                      borderRadius: '12px', overflow: 'hidden',
                      border: `1px solid ${t.border}`,
                    }}>
                      <img
                        src={`${process.env.NEXT_PUBLIC_API_URL}${result.original_url}`}
                        alt="Original scan"
                        style={{ width: '100%', display: 'block' }}
                      />
                    </div>
                  </div>
                  <div>
                    <p style={{
                      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                      letterSpacing: '0.08em', marginBottom: '8px', color: '#7c3aed',
                    }}>
                      ⬡ Grad-CAM Explanation
                    </p>
                    <div style={{
                      borderRadius: '12px', overflow: 'hidden',
                      border: '1px solid rgba(124,58,237,0.3)',
                      boxShadow: '0 0 20px rgba(124,58,237,0.1)',
                    }}>
                      <img
                        src={`${process.env.NEXT_PUBLIC_API_URL}${result.gradcam_url}`}
                        alt="Grad-CAM heatmap"
                        style={{ width: '100%', display: 'block' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: '8px',
                  paddingTop: '14px', borderTop: `1px solid ${t.border}`,
                }}>
                  <span style={{ fontSize: '12px', color: t.textMuted }}>
                    Record{' '}
                    <span style={{ fontFamily: 'monospace', color: t.textSub }}>
                      #{result.id}
                    </span>
                  </span>
                  <button
                    onClick={() => setResult(null)}
                    style={{
                      background: 'none', border: `1px solid ${t.border}`,
                      color: t.textMuted, padding: '4px 12px', borderRadius: '6px',
                      fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    ↩ New scan
                  </button>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>
                    ✓ Saved to database
                  </span>
                </div>
              </div>
            ) : (
              /* Empty state */
              <div style={{
                background: t.surface, border: `1.5px dashed ${t.border}`,
                borderRadius: '18px', minHeight: isMobile ? '220px' : '480px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(12px)', padding: '40px',
              }}>
                <div style={{ position: 'relative', width: '72px', height: '72px', marginBottom: '20px' }}>
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="34"
                      fill='rgba(79,70,229,0.12)'
                      strokeWidth="1" strokeDasharray="4 4"
                      style={{ transformOrigin: '36px 36px', animation: 'rotate 20s linear infinite' }}
                    />
                    <circle cx="36" cy="36" r="24"
                      fill="none" stroke='rgba(79,70,229,0.08)'
                      strokeWidth="1"
                      style={{ transformOrigin: '36px 36px', animation: 'rotateR 15s linear infinite' }}
                    />
                    <circle cx="36" cy="36" r="14"
                      fill='rgba(79,70,229,0.08)'
                      style={{ animation: 'pulse 3s ease-in-out infinite' }}
                    />
                    <circle cx="36" cy="36" r="6" fill="#4f46e5" opacity="0.8" />
                    <circle cx="39" cy="33" r="2.5" fill="rgba(255,255,255,0.7)" />
                  </svg>
                </div>
                <p style={{
                  fontWeight: '700', fontSize: '16px', color: t.text,
                  marginBottom: '8px', textAlign: 'center',
                }}>
                  Upload a retinal scan to begin
                </p>
                <p style={{
                  color: t.textMuted, fontSize: '13px',
                  textAlign: 'center', maxWidth: '260px', lineHeight: 1.6,
                }}>
                  AI will classify the condition and generate a Grad-CAM heatmap showing what it detected
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showLiveMonitor && (
        <LiveMonitor
          theme="light"
          onClose={() => setShowLiveMonitor(false)}
          onComplete={fetchScanCount}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes livePulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:0.5; transform:scale(0.85); }
        }
        @keyframes rotate  { to { transform: rotate(360deg);  } }
        @keyframes rotateR { to { transform: rotate(-360deg); } }
        @keyframes pulse {
          0%,100% { opacity:0.6; transform:scale(1);    }
          50%     { opacity:1;   transform:scale(1.1); }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 3px; }
      `}</style>
    </div>
  );
}