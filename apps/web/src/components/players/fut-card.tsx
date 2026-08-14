import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage, Button } from '@pitchzone/ui';

import type { PlayerProfileOverview } from '@/lib/api';

interface FutCardProps {
  card: PlayerProfileOverview['card'];
  player: PlayerProfileOverview['player'];
}

export function FutCard({ card, player }: FutCardProps) {
  const attrs = [
    { label: 'АТК', value: card.attributes.attack },
    { label: 'ПАС', value: card.attributes.passing },
    { label: 'ДРБ', value: card.attributes.dribbling },
    { label: 'СОЗ', value: card.attributes.creation },
    { label: 'ОБО', value: card.attributes.defense },
    { label: 'ФИЗ', value: card.attributes.physical },
  ];

  return (
    <div className="border-accent/30 relative mx-auto w-full max-w-xs overflow-hidden rounded-2xl border bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-5 shadow-xl">
      <div className="text-muted-foreground absolute right-3 top-3 text-xs font-medium">
        {card.positionLabel}
      </div>
      <div className="font-display text-accent text-5xl font-bold">{card.rating}</div>
      <Avatar className="mt-4 h-20 w-20 rounded-xl">
        <AvatarImage src={player.avatar ?? undefined} />
        <AvatarFallback className="rounded-xl text-2xl font-bold">
          {player.nickname.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <h3 className="font-display mt-3 text-xl font-bold">{player.nickname}</h3>
      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
        {player.countryCode && <span>{player.countryCode}</span>}
        {card.currentTeam && (
          <Link href={`/teams/${card.currentTeam.id}`} className="text-accent hover:underline">
            [{card.currentTeam.tag}]
          </Link>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {attrs.map((a) => (
          <div key={a.label} className="flex justify-between">
            <span className="text-muted-foreground">{a.label}</span>
            <span className="font-semibold">{a.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
          <Link href="/faq#rating">Как считается рейтинг</Link>
        </Button>
        <Button variant="secondary" size="sm" className="flex-1 text-xs" disabled>
          Скачать
        </Button>
      </div>
    </div>
  );
}
