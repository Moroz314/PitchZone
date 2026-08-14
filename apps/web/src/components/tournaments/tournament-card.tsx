'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { motion } from 'framer-motion';

import {
  Badge,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@pitchzone/ui';

import { type TournamentListItem } from '@/lib/api';
import {
  formatCountdown,
  formatCurrency,
  getStatusBadgeVariant,
  getStatusLabel,
  isRegistrationOpen,
} from '@/lib/mock-data';

interface TournamentCardProps {
  tournament: TournamentListItem;
  index?: number;
}

export function TournamentCard({ tournament, index = 0 }: TournamentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Link href={`/tournaments/${tournament.slug}`}>
        <Card className="group glass overflow-hidden transition-all duration-300 hover:border-accent/30 hover:shadow-glow">
          <div className={`relative h-32 bg-gradient-to-br ${tournament.bannerGradient}`}>
            <div className="absolute left-4 top-4">
              <Badge variant={getStatusBadgeVariant(tournament.status)}>
                {getStatusLabel(tournament.status)}
              </Badge>
            </div>
            <div className="absolute bottom-4 left-4">
              <span className="text-xs font-medium text-muted-foreground">{tournament.game}</span>
            </div>
          </div>

          <CardHeader className="pb-2">
            <CardTitle className="line-clamp-1 text-lg transition-colors group-hover:text-accent">
              {tournament.title}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{tournament.format}</p>
          </CardHeader>

          <CardContent className="space-y-3 pb-4">
            <div className="prize-card rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Призовой фонд</p>
              <p className="font-display text-2xl font-bold text-gradient">
                {formatCurrency(tournament.prizePool)}
              </p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {tournament.participants}/{tournament.maxParticipants}
                </span>
              </div>
              {isRegistrationOpen(tournament.status) && (
                <span className="text-xs text-accent">
                  Старт через {formatCountdown(tournament.startsAt)}
                </span>
              )}
              {tournament.status === 'live' && (
                <span className="text-xs text-live">Матчи идут</span>
              )}
            </div>
          </CardContent>

          <CardFooter className="border-t border-border/50 pt-4">
            <span className="text-sm text-muted-foreground">
              Взнос:{' '}
              <span className="font-medium text-foreground">
                {formatCurrency(tournament.entryFee)}
              </span>
            </span>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}
