import React from 'react';
import { motion } from 'framer-motion';

// A simple animated 2D avatar. Mouth opening is driven by the live audio amplitude.
export default function Avatar({ amplitude = 0, speaking = false, size = 220 }) {
  const mouthOpen = speaking ? 6 + amplitude * 34 : 4;
  const mouthWidth = 46 + amplitude * 10;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }} data-testid="ai-avatar">
      <motion.div
        className="absolute rounded-full"
        style={{ width: size * 0.92, height: size * 0.92, background: 'radial-gradient(circle at 50% 40%, rgba(0,229,255,0.18), transparent 70%)' }}
        animate={{ scale: speaking ? 1 + amplitude * 0.06 : 1, opacity: speaking ? 0.9 : 0.5 }}
        transition={{ duration: 0.12 }}
      />
      <motion.div
        className="absolute rounded-full border"
        style={{ width: size * 0.82, height: size * 0.82, borderColor: 'rgba(227,255,55,0.5)' }}
        animate={{ boxShadow: speaking ? `0 0 ${18 + amplitude * 30}px rgba(227,255,55,0.4)` : '0 0 8px rgba(227,255,55,0.15)' }}
        transition={{ duration: 0.12 }}
      />
      <svg viewBox="0 0 200 200" width={size * 0.66} height={size * 0.66} className="relative z-10">
        <defs>
          <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#232329" />
            <stop offset="100%" stopColor="#151518" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="92" fill="url(#face)" stroke="#3a3a40" strokeWidth="2" />
        {/* eyes */}
        <g fill="#e3ff37">
          <motion.ellipse cx="72" cy="86" rx="10"
            initial={{ ry: 12 }} animate={{ ry: [12, 12, 2, 12] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.94, 0.97, 1], ease: 'easeInOut' }} />
          <motion.ellipse cx="128" cy="86" rx="10"
            initial={{ ry: 12 }} animate={{ ry: [12, 12, 2, 12] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.94, 0.97, 1], ease: 'easeInOut' }} />
        </g>
        {/* brows */}
        <rect x="60" y="64" width="26" height="4" rx="2" fill="#00e5ff" opacity="0.8" />
        <rect x="114" y="64" width="26" height="4" rx="2" fill="#00e5ff" opacity="0.8" />
        {/* mouth */}
        <rect x={100 - mouthWidth / 2} y={124 - mouthOpen / 2} width={mouthWidth} height={mouthOpen} rx={mouthOpen / 2}
          fill="#00e5ff" opacity="0.92" />
      </svg>
      {speaking && (
        <motion.div className="absolute -bottom-1 flex gap-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="w-1.5 rounded-full bg-primary"
              animate={{ height: [6, 6 + amplitude * 20 + i * 3, 6] }}
              transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.08 }} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
