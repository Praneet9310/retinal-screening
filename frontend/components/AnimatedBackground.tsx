'use client';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedBackgroundProps {
  theme: 'dark' | 'light';
}

export default function AnimatedBackground({ theme }: AnimatedBackgroundProps) {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Particle network on canvas
  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const COUNT = 55;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isDark = theme === 'dark';
      const dotColor = isDark ? 'rgba(99,102,241,0.55)' : 'rgba(99,102,241,0.35)';
      const lineColor = isDark
        ? (a: number) => `rgba(99,102,241,${a * 0.18})`
        : (a: number) => `rgba(99,102,241,${a * 0.12})`;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = lineColor(1 - dist / 130);
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [mounted, theme]);

  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      overflow: 'hidden',
      background: isDark
        ? '#020817'
        : 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdf4 100%)',
      transition: 'background 0.5s ease',
    }}>

      {/* Canvas particle network */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Blue orb — top left */}
      <motion.div
        style={{
          position: 'absolute', borderRadius: '50%',
          width: '650px', height: '650px',
          background: isDark
            ? 'radial-gradient(circle, rgba(59,130,246,0.28) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          top: '-180px', left: '-180px',
          filter: 'blur(50px)',
        }}
        animate={{ x: [0, 90, -20, 0], y: [0, 60, 30, 0], scale: [1, 1.12, 0.95, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Violet orb — bottom right */}
      <motion.div
        style={{
          position: 'absolute', borderRadius: '50%',
          width: '750px', height: '750px',
          background: isDark
            ? 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
          bottom: '-220px', right: '-220px',
          filter: 'blur(55px)',
        }}
        animate={{ x: [0, -70, 20, 0], y: [0, -90, -20, 0], scale: [1, 1.18, 0.98, 1] }}
        transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Cyan orb — center */}
      <motion.div
        style={{
          position: 'absolute', borderRadius: '50%',
          width: '350px', height: '350px',
          background: isDark
            ? 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)',
          top: '35%', left: '38%',
          filter: 'blur(35px)',
        }}
        animate={{ x: [0, 50, -50, 20, 0], y: [0, -50, 40, -20, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Rose orb — top right (new) */}
      <motion.div
        style={{
          position: 'absolute', borderRadius: '50%',
          width: '400px', height: '400px',
          background: isDark
            ? 'radial-gradient(circle, rgba(244,63,94,0.1) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(244,63,94,0.06) 0%, transparent 70%)',
          top: '-80px', right: '10%',
          filter: 'blur(45px)',
        }}
        animate={{ x: [0, -40, 30, 0], y: [0, 70, 20, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Emerald orb — bottom left (new) */}
      <motion.div
        style={{
          position: 'absolute', borderRadius: '50%',
          width: '300px', height: '300px',
          background: isDark
            ? 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)',
          bottom: '10%', left: '5%',
          filter: 'blur(40px)',
        }}
        animate={{ x: [0, 60, -20, 0], y: [0, -40, 20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: isDark ? 0.03 : 0.04,
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.8) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.8) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        transition: 'opacity 0.5s ease',
      }} />

      {/* Scanline shimmer (dark only) */}
      {isDark && (
        <motion.div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(transparent 0%, rgba(99,102,241,0.015) 50%, transparent 100%)',
            backgroundSize: '100% 8px',
          }}
          animate={{ backgroundPositionY: ['0px', '8px'] }}
          transition={{ duration: 0.15, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
}