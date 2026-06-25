'use client';
import { useState } from 'react';
import AnimatedBackground from '@/components/AnimatedBackground';
import Uploader from '@/components/Uploader';

type Theme = 'dark' | 'light';

interface Result {
  id: number;
  disease: string;
  confidence: number;
  risk_level: string;
  original_url: string;
  gradcam_url: string;
}

// ── theme token helpers ──────────────────────────────────────────
const t = {
  text:        (th: Theme) => th === 'dark' ? '#f1f5f9' : '#0f172a',
  textMuted:   (th: Theme) => th === 'dark' ? '#94a3b8' : '#475569',
  textFaint:   (th: Theme) => th === 'dark' ? '#475569' : '#94a3b8',
  card:        (th: Theme) => th === 'dark' ? 'rgba(15,23,42,0.6)'  : 'rgba(255,255,255,0.7)',
  cardStrong:  (th: Theme) => th === 'dark' ? 'rgba(15,23,42,0.8)'  : 'rgba(255,255,255,0.9)',
  border:      (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.2)',
  borderAccent:(th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.3)'  : 'rgba(99,102,241,0.35)',
  divider:     (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.2)'  : 'rgba(99,102,241,0.15)',
  emptyBg:     (th: Theme) => th === 'dark' ? 'rgba(15,23,42,0.4)'   : 'rgba(255,255,255,0.5)',
  emptyBorder: (th: Theme) => th === 'dark' ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.25)',
  resultBorder:(th: Theme) => th === 'dark' ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.35)',
  btnSwitch:   (th: Theme) => th === 'dark'
    ? 'rgba(15,23,42,0.8)'
    : 'rgba(255,255,255,0.9)',
  btnSwitchBorder:(th: Theme) => th === 'dark'
    ? 'rgba(99,102,241,0.3)'
    : 'rgba(99,102,241,0.4)',
};

const riskColor  = (r: string) => r === 'High' ? '#f87171' : r === 'Moderate' ? '#fbbf24' : '#34d399';
const riskBg     = (r: string) => r === 'High' ? 'rgba(248,113,113,0.15)' : r === 'Moderate' ? 'rgba(251,191,36,0.15)' : 'rgba(52,211,153,0.15)';
const riskBorder = (r: string) => r === 'High' ? 'rgba(248,113,113,0.3)'  : r === 'Moderate' ? 'rgba(251,191,36,0.3)'  : 'rgba(52,211,153,0.3)';

export default function Dashboard() {
  const [theme, setTheme]   = useState<Theme>('dark');
  const [result, setResult] = useState<Result | null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const toggle = () => setTheme(th => th === 'dark' ? 'light' : 'dark');

  return (
    <div style={{
      minHeight: '100vh',
      color: t.text(theme),
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: '32px',
      position: 'relative',
      transition: 'color 0.3s ease',
    }}>
      <AnimatedBackground theme={theme} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          paddingBottom: '24px', borderBottom: `1px solid ${t.divider(theme)}`,
          marginBottom: '32px', flexWrap: 'wrap', gap: '16px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
              }}>👁️</div>
              <h1 style={{
                fontSize: '32px', fontWeight: 900, margin: 0,
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Retinal Diagnostics AI
              </h1>
            </div>
            <p style={{ color: t.textMuted(theme), fontSize: '14px', margin: 0, marginLeft: '48px' }}>
              Explainable Multi-Class Clinical Decision Support System
            </p>
          </div>

          {/* Right side: badges + theme toggle */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{
              background: t.card(theme), border: `1px solid ${t.border(theme)}`,
              padding: '10px 16px', borderRadius: '12px', fontSize: '14px',
              backdropFilter: 'blur(16px)',
            }}>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>1,248</span>
              <span style={{ color: t.textMuted(theme) }}> Total Scans</span>
            </div>

            <div style={{
              background: t.card(theme), border: '1px solid rgba(52,211,153,0.2)',
              padding: '10px 16px', borderRadius: '12px', fontSize: '14px',
              backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#34d399', boxShadow: '0 0 8px #34d399',
                animation: 'orbPulse 2s infinite',
              }} />
              <span style={{ color: '#34d399', fontWeight: 600 }}>System Online</span>
            </div>

            {/* ── Theme toggle button ── */}
            <button
              onClick={toggle}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 16px', borderRadius: '12px', cursor: 'pointer',
                background: t.btnSwitch(theme), border: `1px solid ${t.btnSwitchBorder(theme)}`,
                color: t.text(theme), fontSize: '14px', fontWeight: 600,
                backdropFilter: 'blur(16px)',
                boxShadow: theme === 'dark'
                  ? '0 2px 12px rgba(99,102,241,0.2)'
                  : '0 2px 12px rgba(99,102,241,0.12)',
              }}
            >
              {/* Track */}
              <div style={{
                width: '36px', height: '20px', borderRadius: '10px', position: 'relative',
                background: theme === 'dark'
                  ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)'
                  : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                transition: 'background 0.4s ease',
                flexShrink: 0,
              }}>
                {/* Thumb */}
                <div style={{
                  position: 'absolute', top: '2px',
                  left: theme === 'dark' ? '2px' : '18px',
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.3s ease',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                }} />
              </div>
              <span style={{ fontSize: '16px' }}>{theme === 'dark' ? '🌙' : '☀️'}</span>
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px', marginBottom: '32px',
        }}>
          {[
            { label: 'Model Accuracy',  value: '94.2%',  color: '#60a5fa' },
            { label: 'Avg Confidence',  value: '91.7%',  color: '#a78bfa' },
            { label: 'Disease Classes', value: '5',       color: '#34d399' },
            { label: 'Grad-CAM XAI',   value: 'Active',  color: '#f59e0b' },
          ].map((stat) => (
            <div key={stat.label}
              style={{
                background: t.card(theme), border: `1px solid ${t.border(theme)}`,
                borderRadius: '16px', padding: '20px', backdropFilter: 'blur(16px)',
                transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${stat.color}33`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: '28px', fontWeight: 900, color: stat.color, marginBottom: '4px' }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: '12px', color: t.textFaint(theme), fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>

          {/* Left panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Uploader card */}
            <div style={{
              background: t.card(theme), border: `1px solid ${t.borderAccent(theme)}`,
              borderRadius: '20px', overflow: 'hidden', backdropFilter: 'blur(16px)',
              boxShadow: '0 0 40px rgba(99,102,241,0.08)',
            }}>
              <Uploader onComplete={setResult} theme={theme} />
            </div>

            {/* Disease classes */}
            <div style={{
              background: t.card(theme), border: `1px solid ${t.border(theme)}`,
              borderRadius: '20px', padding: '24px', backdropFilter: 'blur(16px)',
            }}>
              <p style={{
                fontSize: '11px', fontWeight: 700, color: t.textFaint(theme),
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px',
              }}>Disease Classes</p>
              {[
                { name: 'Normal Retina',        color: '#34d399', risk: 'Low'      },
                { name: 'Diabetic Retinopathy', color: '#fbbf24', risk: 'High'     },
                { name: 'Glaucoma',             color: '#f87171', risk: 'High'     },
                { name: 'Cataract',             color: '#fb923c', risk: 'Moderate' },
                { name: 'AMD',                  color: '#c084fc', risk: 'High'     },
              ].map((cls, i, arr) => (
                <div key={cls.name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < arr.length - 1 ? `1px solid ${t.border(theme)}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: cls.color, boxShadow: `0 0 6px ${cls.color}`, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '13px', color: t.text(theme) }}>{cls.name}</span>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '3px 8px',
                    borderRadius: '20px', textTransform: 'uppercase',
                    background: riskBg(cls.risk), color: riskColor(cls.risk),
                    border: `1px solid ${riskBorder(cls.risk)}`,
                  }}>{cls.risk}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel — results */}
          <div>
            {result ? (
              <div style={{
                background: t.cardStrong(theme), border: `1px solid ${t.resultBorder(theme)}`,
                borderRadius: '20px', padding: '32px', backdropFilter: 'blur(16px)',
                boxShadow: '0 0 60px rgba(139,92,246,0.08)',
                animation: 'fadeIn 0.4s ease',
              }}>
                {/* Result header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  marginBottom: '28px', flexWrap: 'wrap', gap: '16px',
                }}>
                  <div>
                    <p style={{ fontSize: '11px', color: t.textFaint(theme), textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                      Diagnosis Result
                    </p>
                    <h2 style={{ fontSize: '28px', fontWeight: 900, color: t.text(theme), marginBottom: '12px' }}>
                      {result.disease}
                    </h2>
                    <span style={{
                      padding: '6px 14px', borderRadius: '20px', fontSize: '11px',
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                      background: riskBg(result.risk_level), color: riskColor(result.risk_level),
                      border: `1px solid ${riskBorder(result.risk_level)}`,
                    }}>● {result.risk_level} Risk</span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '52px', fontWeight: 900, lineHeight: 1,
                      background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                      {(result.confidence * 100).toFixed(1)}%
                    </div>
                    <div style={{ color: t.textFaint(theme), fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>
                      Confidence Score
                    </div>
                    <div style={{
                      width: '120px', height: '4px', background: 'rgba(99,102,241,0.2)',
                      borderRadius: '2px', marginTop: '8px', marginLeft: 'auto',
                    }}>
                      <div style={{
                        width: `${(result.confidence * 100).toFixed(1)}%`, height: '100%',
                        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                        borderRadius: '2px', transition: 'width 1s ease',
                      }} />
                    </div>
                  </div>
                </div>

                {/* Images */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: t.textFaint(theme), textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 700 }}>
                      Original Scan
                    </p>
                    <img src={`${API}${result.original_url}`} alt="Original retinal scan"
                      style={{ width: '100%', borderRadius: '12px', border: `1px solid ${t.border(theme)}`, display: 'block' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 700 }}>
                      ⬡ Grad-CAM Heatmap
                    </p>
                    <img src={`${API}${result.gradcam_url}`} alt="Grad-CAM heatmap"
                      style={{ width: '100%', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 20px rgba(139,92,246,0.12)', display: 'block' }} />
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  paddingTop: '16px', borderTop: `1px solid ${t.border(theme)}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '12px', color: t.textFaint(theme) }}>
                    Record ID: <span style={{ color: t.textMuted(theme), fontFamily: 'monospace' }}>#{result.id}</span>
                  </span>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#34d399' }}>✓ Saved to database</span>
                    <button onClick={() => setResult(null)} style={{
                      padding: '6px 14px', borderRadius: '8px', fontSize: '12px',
                      border: `1px solid ${t.borderAccent(theme)}`,
                      background: t.card(theme), color: t.textMuted(theme),
                      cursor: 'pointer', fontWeight: 600,
                    }}>← New Scan</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: t.emptyBg(theme), border: `1px dashed ${t.emptyBorder(theme)}`,
                borderRadius: '20px', minHeight: '500px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(16px)',
              }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '28px', marginBottom: '16px',
                }}>👁️</div>
                <p style={{ color: t.textMuted(theme), fontWeight: 600, marginBottom: '6px' }}>
                  Upload a retinal scan to begin
                </p>
                <p style={{ color: t.textFaint(theme), fontSize: '13px' }}>
                  AI diagnosis + Grad-CAM visualization will appear here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes orbPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}