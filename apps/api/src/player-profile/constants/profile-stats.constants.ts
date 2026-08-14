import { PlayerPosition } from '@prisma/client';

export const POSITION_GROUP_LABELS: Record<string, string> = {
  GK: 'Вратарь',
  CB: 'Центр. защ.',
  FB: 'Фланг. защ.',
  DM: 'Опорн. полузащ.',
  CM: 'Центр. полузащ.',
  WM: 'Фланг. полузащ.',
  AM: 'Атак. полузащ.',
  ST: 'Нападающий',
};

export function positionToGroup(position: PlayerPosition): string {
  switch (position) {
    case PlayerPosition.GK:
      return 'GK';
    case PlayerPosition.CB:
      return 'CB';
    case PlayerPosition.LB:
    case PlayerPosition.RB:
      return 'FB';
    case PlayerPosition.CDM:
      return 'DM';
    case PlayerPosition.CM:
      return 'CM';
    case PlayerPosition.LM:
    case PlayerPosition.RM:
    case PlayerPosition.LW:
    case PlayerPosition.RW:
      return 'WM';
    case PlayerPosition.CAM:
      return 'AM';
    case PlayerPosition.ST:
    case PlayerPosition.CF:
      return 'ST';
    default:
      return 'CM';
  }
}

export function xpToMatchRating(xpEarned: number): number {
  return Math.round(Math.min(10, 6 + xpEarned / 12) * 100) / 100;
}

export const STAT_CATEGORIES = [
  { id: 'summary', label: 'Общая сводка' },
  { id: 'shooting', label: 'Удары' },
  { id: 'passing', label: 'Пасы' },
  { id: 'movement', label: 'Перемещение' },
  { id: 'defense', label: 'Отбор мяча' },
  { id: 'goalkeeper', label: 'Вратарские' },
] as const;

export type StatCategoryId = (typeof STAT_CATEGORIES)[number]['id'];
