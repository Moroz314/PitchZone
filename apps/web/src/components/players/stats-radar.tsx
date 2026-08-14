'use client';

import { motion } from 'framer-motion';

import { type Player } from '@/lib/mock-data';

interface StatsRadarProps {
  stats: Player['stats'];
}

const STAT_LABELS: Record<keyof Player['stats'], string> = {
  attack: 'Атака',
  defense: 'Защита',
  passing: 'Пас',
  positioning: 'Позиция',
  consistency: 'Стабильность',
};

export function StatsRadar({ stats }: StatsRadarProps) {
  const entries = Object.entries(stats) as [keyof Player['stats'], number][];
  const center = 120;
  const maxRadius = 80;
  const angleStep = (2 * Math.PI) / entries.length;

  const points = entries.map(([, value], i) => {
    const angle = angleStep * i - Math.PI / 2;
    const radius = (value / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 240" className="h-60 w-60">
        {gridLevels.map((level) => {
          const r = (level / 100) * maxRadius;
          const gridPoints = entries.map((_, i) => {
            const angle = angleStep * i - Math.PI / 2;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
          });
          return (
            <polygon
              key={level}
              points={gridPoints.join(' ')}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
            />
          );
        })}

        {entries.map((_, i) => {
          const angle = angleStep * i - Math.PI / 2;
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + maxRadius * Math.cos(angle)}
              y2={center + maxRadius * Math.sin(angle)}
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
            />
          );
        })}

        <motion.polygon
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          points={polygonPoints}
          fill="hsl(var(--accent) / 0.2)"
          stroke="hsl(var(--accent))"
          strokeWidth="2"
          style={{ transformOrigin: `${center}px ${center}px` }}
        />

        {entries.map(([key], i) => {
          const angle = angleStep * i - Math.PI / 2;
          const labelRadius = maxRadius + 24;
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle);
          return (
            <text
              key={key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {STAT_LABELS[key]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
