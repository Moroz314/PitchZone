'use client';

import { motion } from 'framer-motion';

import { Button } from '@pitchzone/ui';

import { PLATFORM_STATS } from '@/lib/mock-data';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="bg-hero-glow absolute inset-0" />
      <div className="relative mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        ></motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {[
            { label: 'Активных турниров', value: PLATFORM_STATS.activeTournaments },
            { label: 'Игроков', value: `${(PLATFORM_STATS.totalPlayers / 1000).toFixed(1)}K` },
            {
              label: 'Выплачено призов',
              value: `${(PLATFORM_STATS.prizePoolPaid / 1000000).toFixed(1)}M ₽`,
            },
            { label: 'Матчей сегодня', value: PLATFORM_STATS.matchesToday },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-lg p-4 text-center">
              <p className="font-display text-accent text-2xl font-bold">{stat.value}</p>
              <p className="text-muted-foreground mt-1 text-xs">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
