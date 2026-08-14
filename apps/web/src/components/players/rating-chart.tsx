'use client';

import { motion } from 'framer-motion';

import { type Player } from '@/lib/mock-data';

interface RatingChartProps {
  history: Player['ratingHistory'];
}

export function RatingChart({ history }: RatingChartProps) {
  if (history.length === 0) {
    return (
      <p className="text-muted-foreground flex h-40 items-center justify-center text-sm">
        Недостаточно матчей для графика рейтинга
      </p>
    );
  }

  const width = 400;
  const height = 160;
  const padding = { top: 16, right: 16, bottom: 24, left: 40 };

  const ratings = history.map((h) => h.rating);
  const minRating = Math.min(...ratings) - 50;
  const maxRating = Math.max(...ratings) + 50;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = history.map((point, i) => {
    const x =
      history.length === 1
        ? padding.left + chartWidth / 2
        : padding.left + (i / (history.length - 1)) * chartWidth;
    const y =
      padding.top +
      chartHeight -
      ((point.rating - minRating) / (maxRating - minRating)) * chartHeight;
    return { x, y, ...point };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    points.length === 1
      ? `${linePath} L ${points[0].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`
      : `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full min-w-[300px]">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartHeight * (1 - ratio);
          const value = Math.round(minRating + (maxRating - minRating) * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="hsl(var(--border))"
                strokeWidth="0.5"
                strokeDasharray="4"
              />
              <text
                x={padding.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {value}
              </text>
            </g>
          );
        })}

        <motion.path
          d={areaPath}
          fill="url(#ratingGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />

        <motion.path
          d={linePath}
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />

        {points.map((point) => (
          <circle key={point.date} cx={point.x} cy={point.y} r="3" fill="hsl(var(--accent))" />
        ))}

        {points.map((point) => (
          <text
            key={`label-${point.date}`}
            x={point.x}
            y={height - 4}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px]"
          >
            {point.date}
          </text>
        ))}

        <defs>
          <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent) / 0.3)" />
            <stop offset="100%" stopColor="hsl(var(--accent) / 0)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
