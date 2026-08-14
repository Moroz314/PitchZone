import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DivisionTier,
  SeasonStatus,
  SeasonType,
} from '@prisma/client';

import { PlatformSettingsService } from '../admin/platform-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CalculateAnnualDto,
  CreateSeasonDto,
  SetPromotionRulesDto,
  UpdateSeasonDto,
  UpdateSeasonEntryDto,
} from './dto/season.dto';

const DIVISION_LABELS: Record<DivisionTier, string> = {
  GOLD: 'Золотая лига',
  SILVER: 'Серебряная лига',
  BRONZE: 'Бронзовая лига',
  NONE: 'Общая группа',
};

function divisionDisplayLabel(division: { name: DivisionTier; groupLabel: string }) {
  return division.groupLabel || DIVISION_LABELS[division.name];
}

const CALENDAR_SLOTS = [
  { id: 'AUTUMN_WINTER', label: 'Осень-зима', months: 'октябрь – декабрь' },
  { id: 'WINTER_SPRING', label: 'Зима-весна', months: 'январь – март' },
  { id: 'SPRING_SUMMER', label: 'Весна-лето', months: 'апрель – июнь' },
];

@Injectable()
export class SeasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  getCalendar() {
    return CALENDAR_SLOTS;
  }

  async listPublic(status?: SeasonStatus) {
    const seasons = await this.prisma.season.findMany({
      where: {
        isPublic: true,
        ...(status ? { status } : {}),
      },
      orderBy: [{ year: 'desc' }, { startDate: 'desc' }],
      include: {
        divisions: { orderBy: { tierOrder: 'asc' } },
        _count: { select: { entries: true } },
      },
    });

    return seasons.map((s) => this.formatSeasonSummary(s));
  }

  async getCurrent() {
    const season =
      (await this.prisma.season.findFirst({
        where: {
          isPublic: true,
          status: { in: [SeasonStatus.REGISTRATION, SeasonStatus.ACTIVE] },
        },
        orderBy: { startDate: 'asc' },
        include: {
          divisions: { orderBy: { tierOrder: 'asc' } },
          _count: { select: { entries: true } },
        },
      })) ??
      (await this.prisma.season.findFirst({
        where: { isPublic: true, status: SeasonStatus.UPCOMING },
        orderBy: { startDate: 'asc' },
        include: {
          divisions: { orderBy: { tierOrder: 'asc' } },
          _count: { select: { entries: true } },
        },
      }));

    return season ? this.formatSeasonSummary(season) : null;
  }

  async getById(id: string) {
    const season = await this.prisma.season.findUnique({
      where: { id },
      include: {
        divisions: { orderBy: { tierOrder: 'asc' } },
        promotionRules: { include: { division: true } },
        _count: { select: { entries: true } },
      },
    });

    if (!season) throw new NotFoundException('Сезон не найден');
    return this.formatSeasonDetail(season);
  }

  async getStandings(seasonId: string, divisionId?: string) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { divisions: { orderBy: { tierOrder: 'asc' } } },
    });
    if (!season) throw new NotFoundException('Сезон не найден');

    const entries = await this.prisma.seasonTeamEntry.findMany({
      where: {
        seasonId,
        ...(divisionId ? { divisionId } : {}),
      },
      include: {
        team: { select: { id: true, name: true, tag: true, avatar: true } },
        division: true,
      },
    });

    const sortEntries = (list: typeof entries) =>
      [...list].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
        return b.goalsFor - a.goalsFor;
      });

    if (!season.hasDivisions) {
      return {
        seasonId,
        hasDivisions: false,
        tables: [
          {
            division: null,
            divisionLabel: 'Общая таблица',
            entries: sortEntries(entries).map((e, i) => this.formatEntry(e, i + 1)),
          },
        ],
      };
    }

    const divisions = divisionId
      ? season.divisions.filter((d) => d.id === divisionId)
      : season.divisions;

    return {
      seasonId,
      hasDivisions: true,
      tables: divisions.map((division) => {
        const divisionEntries = entries.filter((e) => e.divisionId === division.id);
        return {
          division: {
            id: division.id,
            name: division.name,
            groupLabel: division.groupLabel,
            tierOrder: division.tierOrder,
          },
          divisionLabel: divisionDisplayLabel(division),
          entries: sortEntries(divisionEntries).map((e, i) => this.formatEntry(e, i + 1)),
        };
      }),
    };
  }

  async registerTeam(seasonId: string, userId: string, teamId: string) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { divisions: true },
    });
    if (!season) throw new NotFoundException('Сезон не найден');

    if (season.status !== SeasonStatus.REGISTRATION) {
      throw new BadRequestException('Регистрация на этот сезон закрыта');
    }

    if (season.type !== SeasonType.REGULAR) {
      throw new BadRequestException('На развлекательный турнир регистрация через отдельный флоу');
    }

    await this.ensureCaptainOrOwner(teamId, userId);

    const existing = await this.prisma.seasonTeamEntry.findUnique({
      where: { seasonId_teamId: { seasonId, teamId } },
    });
    if (existing) throw new ConflictException('Команда уже заявлена на сезон');

    const divisionId = await this.resolveDivisionForTeam(season, teamId);

    const entry = await this.prisma.seasonTeamEntry.create({
      data: {
        seasonId,
        teamId,
        managerId: userId,
        divisionId,
      },
      include: {
        team: { select: { id: true, name: true, tag: true, avatar: true } },
        division: true,
      },
    });

    return this.formatEntry(entry, null);
  }

  async getLanPath(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const standings = await this.prisma.annualStanding.findMany({
      where: { year: targetYear },
      include: { team: { select: { id: true, name: true, tag: true, avatar: true } } },
      orderBy: [{ qualifiedForLan: 'desc' }, { rank: 'asc' }],
    });

    if (standings.length === 0) {
      return {
        year: targetYear,
        calculated: false,
        qualifyTopN: (await this.platformSettings.getSettings()).lanQualifyTopN,
        standings: [],
        message: 'Годовой зачёт ещё не рассчитан администратором',
      };
    }

    const settings = await this.platformSettings.getSettings();

    return {
      year: targetYear,
      calculated: true,
      qualifyTopN: settings.lanQualifyTopN,
      standings: standings.map((s) => ({
        rank: s.rank,
        team: s.team,
        totalPoints: s.totalPointsAcrossSeasons,
        seasonsPlayed: s.seasonsPlayed,
        qualifiedForLan: s.qualifiedForLan,
      })),
    };
  }

  // --- Admin ---

  async adminList() {
    const seasons = await this.prisma.season.findMany({
      orderBy: [{ year: 'desc' }, { startDate: 'desc' }],
      include: {
        divisions: { orderBy: { tierOrder: 'asc' } },
        _count: { select: { entries: true } },
      },
    });
    return seasons.map((s) => this.formatSeasonSummary(s));
  }

  async adminCreate(dto: CreateSeasonDto) {
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('Дата окончания должна быть позже начала');
    }

    const season = await this.prisma.season.create({
      data: {
        name: dto.name,
        type: dto.type,
        year: dto.year,
        calendarSlot: dto.calendarSlot,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: dto.status ?? SeasonStatus.UPCOMING,
        hasDivisions: dto.hasDivisions,
        entryFee: dto.entryFee ?? 0,
        lanPointsWeight: dto.lanPointsWeight ?? 1.0,
      },
    });

    await this.ensureDivisions(season.id, dto.hasDivisions);

    return this.getById(season.id);
  }

  async adminUpdate(id: string, dto: UpdateSeasonDto) {
    const season = await this.prisma.season.findUnique({ where: { id } });
    if (!season) throw new NotFoundException('Сезон не найден');

    if (season.status === SeasonStatus.FINISHED) {
      throw new BadRequestException('Завершённый сезон нельзя редактировать');
    }

    if (dto.hasDivisions !== undefined && dto.hasDivisions !== season.hasDivisions) {
      const entryCount = await this.prisma.seasonTeamEntry.count({ where: { seasonId: id } });
      if (entryCount > 0) {
        throw new BadRequestException('Нельзя менять структуру дивизионов после регистрации команд');
      }
      await this.prisma.division.deleteMany({ where: { seasonId: id } });
      await this.prisma.season.update({ where: { id }, data: { hasDivisions: dto.hasDivisions } });
      await this.ensureDivisions(id, dto.hasDivisions);
    }

    await this.prisma.season.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        year: dto.year,
        calendarSlot: dto.calendarSlot,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status,
        entryFee: dto.entryFee,
        lanPointsWeight: dto.lanPointsWeight,
      },
    });

    return this.getById(id);
  }

  async adminDelete(id: string) {
    const season = await this.prisma.season.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!season) throw new NotFoundException('Сезон не найден');

    if (season.status !== SeasonStatus.UPCOMING || season._count.entries > 0) {
      throw new BadRequestException('Можно удалить только пустой сезон в статусе «Скоро»');
    }

    await this.prisma.season.delete({ where: { id } });
    return { success: true };
  }

  async adminSetPromotionRules(seasonId: string, dto: SetPromotionRulesDto) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { divisions: true },
    });
    if (!season) throw new NotFoundException('Сезон не найден');
    if (!season.hasDivisions) {
      throw new BadRequestException('Правила повышения/понижения нужны только при дивизионах');
    }

    for (const rule of dto.rules) {
      const division = season.divisions.find((d) => d.id === rule.divisionId);
      if (!division) {
        throw new BadRequestException(`Дивизион ${rule.divisionId} не найден в сезоне`);
      }
    }

    await this.prisma.$transaction([
      this.prisma.promotionRelegationRule.deleteMany({ where: { seasonId } }),
      ...dto.rules.map((rule) =>
        this.prisma.promotionRelegationRule.create({
          data: {
            seasonId,
            divisionId: rule.divisionId,
            promoteTopN: rule.promoteTopN,
            relegateBottomN: rule.relegateBottomN,
          },
        }),
      ),
    ]);

    return this.getById(seasonId);
  }

  async adminUpdateEntry(seasonId: string, entryId: string, dto: UpdateSeasonEntryDto) {
    const entry = await this.prisma.seasonTeamEntry.findFirst({
      where: { id: entryId, seasonId },
    });
    if (!entry) throw new NotFoundException('Заявка не найдена');

    const updated = await this.prisma.seasonTeamEntry.update({
      where: { id: entryId },
      data: dto,
      include: {
        team: { select: { id: true, name: true, tag: true, avatar: true } },
        division: true,
      },
    });

    return this.formatEntry(updated, null);
  }

  async adminFinishSeason(seasonId: string) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { divisions: true },
    });
    if (!season) throw new NotFoundException('Сезон не найден');
    if (season.status === SeasonStatus.FINISHED) {
      throw new BadRequestException('Сезон уже завершён');
    }

    const entries = await this.prisma.seasonTeamEntry.findMany({ where: { seasonId } });

    if (season.hasDivisions) {
      for (const division of season.divisions) {
        const divisionEntries = entries.filter((e) => e.divisionId === division.id);
        const sorted = this.sortEntriesRaw(divisionEntries);
        await Promise.all(
          sorted.map((entry, index) =>
            this.prisma.seasonTeamEntry.update({
              where: { id: entry.id },
              data: { finalPosition: index + 1 },
            }),
          ),
        );
      }
    } else {
      const sorted = this.sortEntriesRaw(entries);
      await Promise.all(
        sorted.map((entry, index) =>
          this.prisma.seasonTeamEntry.update({
            where: { id: entry.id },
            data: { finalPosition: index + 1 },
          }),
        ),
      );
    }

    await this.prisma.season.update({
      where: { id: seasonId },
      data: { status: SeasonStatus.FINISHED },
    });

    return this.getStandings(seasonId);
  }

  async adminCalculateAnnual(dto: CalculateAnnualDto) {
    const settings = await this.platformSettings.getSettings();
    const qualifyTopN = dto.qualifyTopN ?? settings.lanQualifyTopN;

    const seasons = await this.prisma.season.findMany({
      where: {
        year: dto.year,
        type: SeasonType.REGULAR,
        status: SeasonStatus.FINISHED,
      },
      include: { entries: true },
    });

    const teamTotals = new Map<string, { points: number; seasons: number }>();

    for (const season of seasons) {
      for (const entry of season.entries) {
        const weighted = entry.points * season.lanPointsWeight;
        const current = teamTotals.get(entry.teamId) ?? { points: 0, seasons: 0 };
        teamTotals.set(entry.teamId, {
          points: current.points + weighted,
          seasons: current.seasons + 1,
        });
      }
    }

    const ranked = [...teamTotals.entries()]
      .map(([teamId, data]) => ({ teamId, ...data }))
      .sort((a, b) => b.points - a.points);

    await this.prisma.annualStanding.deleteMany({ where: { year: dto.year } });

    await this.prisma.$transaction(
      ranked.map((row, index) =>
        this.prisma.annualStanding.create({
          data: {
            year: dto.year,
            teamId: row.teamId,
            totalPointsAcrossSeasons: row.points,
            seasonsPlayed: row.seasons,
            rank: index + 1,
            qualifiedForLan: index < qualifyTopN,
          },
        }),
      ),
    );

    return this.getLanPath(dto.year);
  }

  private async ensureDivisions(seasonId: string, hasDivisions: boolean) {
    if (hasDivisions) {
      await this.prisma.division.createMany({
        data: [
          { seasonId, name: DivisionTier.GOLD, tierOrder: 1 },
          { seasonId, name: DivisionTier.SILVER, tierOrder: 2 },
          { seasonId, name: DivisionTier.BRONZE, tierOrder: 3 },
        ],
      });
    } else {
      await this.prisma.division.create({
        data: { seasonId, name: DivisionTier.NONE, tierOrder: 0 },
      });
    }
  }

  private async resolveDivisionForTeam(
    season: { id: string; hasDivisions: boolean; divisions: { id: string; name: DivisionTier; tierOrder: number }[] },
    teamId: string,
  ) {
    if (!season.hasDivisions) {
      return season.divisions.find((d) => d.name === DivisionTier.NONE)?.id ?? null;
    }

    const previousEntry = await this.findPreviousSeasonEntry(teamId, season.id);
    if (!previousEntry?.division || previousEntry.finalPosition == null) {
      return season.divisions.find((d) => d.name === DivisionTier.BRONZE)?.id ?? null;
    }

    const prevDivisionName = previousEntry.division.name;
    if (prevDivisionName === DivisionTier.NONE) {
      return season.divisions.find((d) => d.name === DivisionTier.BRONZE)?.id ?? null;
    }

    const position = previousEntry.finalPosition;
    const prevDivisionEntries = await this.prisma.seasonTeamEntry.count({
      where: {
        seasonId: previousEntry.seasonId,
        divisionId: previousEntry.divisionId,
      },
    });

    const newSeasonDivision = season.divisions.find((d) => d.name === prevDivisionName);
    const rule = newSeasonDivision
      ? await this.prisma.promotionRelegationRule.findFirst({
          where: { seasonId: season.id, divisionId: newSeasonDivision.id },
        })
      : null;

    const promoteTopN = rule?.promoteTopN ?? 0;
    const relegateBottomN = rule?.relegateBottomN ?? 0;

    let targetTier = prevDivisionName;

    if (prevDivisionName === DivisionTier.GOLD && position > prevDivisionEntries - relegateBottomN) {
      targetTier = DivisionTier.SILVER;
    } else if (prevDivisionName === DivisionTier.SILVER) {
      if (position <= promoteTopN) targetTier = DivisionTier.GOLD;
      else if (position > prevDivisionEntries - relegateBottomN) targetTier = DivisionTier.BRONZE;
    } else if (prevDivisionName === DivisionTier.BRONZE && position <= promoteTopN) {
      targetTier = DivisionTier.SILVER;
    }

    return season.divisions.find((d) => d.name === targetTier)?.id ?? null;
  }

  private async findPreviousSeasonEntry(teamId: string, currentSeasonId: string) {
    const current = await this.prisma.season.findUnique({ where: { id: currentSeasonId } });
    if (!current) return null;

    return this.prisma.seasonTeamEntry.findFirst({
      where: {
        teamId,
        season: {
          type: SeasonType.REGULAR,
          status: SeasonStatus.FINISHED,
          OR: [{ year: { lt: current.year } }, { year: current.year, endDate: { lt: current.startDate } }],
        },
      },
      orderBy: { season: { endDate: 'desc' } },
      include: {
        division: true,
        season: true,
      },
    });
  }

  private sortEntriesRaw<
    T extends {
      points: number;
      goalsFor: number;
      goalsAgainst: number;
    },
  >(entries: T[]) {
    return [...entries].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    });
  }

  private async ensureCaptainOrOwner(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership || !['OWNER', 'CAPTAIN'].includes(membership.role)) {
      throw new ForbiddenException('Только капитан или владелец клуба может заявить команду');
    }
  }

  private formatSeasonSummary(season: {
    id: string;
    name: string;
    type: SeasonType;
    year: number;
    calendarSlot: string | null;
    startDate: Date;
    endDate: Date;
    status: SeasonStatus;
    hasDivisions: boolean;
    isPublic: boolean;
    entryFee: number;
    lanPointsWeight: number;
    divisions: { id: string; name: DivisionTier; groupLabel: string; tierOrder: number }[];
    _count: { entries: number };
  }) {
    return {
      id: season.id,
      name: season.name,
      type: season.type,
      year: season.year,
      calendarSlot: season.calendarSlot,
      calendarLabel: CALENDAR_SLOTS.find((s) => s.id === season.calendarSlot)?.label ?? null,
      startDate: season.startDate.toISOString(),
      endDate: season.endDate.toISOString(),
      status: season.status,
      hasDivisions: season.hasDivisions,
      entryFee: season.entryFee,
      lanPointsWeight: season.lanPointsWeight,
      isPublic: season.isPublic,
      entryCount: season._count.entries,
      divisions: season.divisions.map((d) => ({
        id: d.id,
        name: d.name,
        groupLabel: d.groupLabel,
        label: divisionDisplayLabel(d),
        tierOrder: d.tierOrder,
      })),
    };
  }

  private formatSeasonDetail(season: {
    id: string;
    name: string;
    type: SeasonType;
    year: number;
    calendarSlot: string | null;
    startDate: Date;
    endDate: Date;
    status: SeasonStatus;
    hasDivisions: boolean;
    isPublic: boolean;
    entryFee: number;
    lanPointsWeight: number;
    divisions: { id: string; name: DivisionTier; groupLabel: string; tierOrder: number }[];
    promotionRules: {
      id: string;
      divisionId: string;
      promoteTopN: number;
      relegateBottomN: number;
      division: { name: DivisionTier; groupLabel: string };
    }[];
    _count: { entries: number };
  }) {
    return {
      ...this.formatSeasonSummary(season),
      promotionRules: season.promotionRules.map((r) => ({
        id: r.id,
        divisionId: r.divisionId,
        divisionName: r.division.name,
        divisionLabel: divisionDisplayLabel(r.division),
        promoteTopN: r.promoteTopN,
        relegateBottomN: r.relegateBottomN,
      })),
    };
  }

  private formatEntry(
    entry: {
      id: string;
      points: number;
      matchesPlayed: number;
      wins: number;
      draws: number;
      losses: number;
      goalsFor: number;
      goalsAgainst: number;
      finalPosition: number | null;
      registeredAt: Date;
      team: { id: string; name: string; tag: string; avatar: string | null };
      division: { id: string; name: DivisionTier } | null;
    },
    tablePosition: number | null,
  ) {
    return {
      id: entry.id,
      tablePosition,
      finalPosition: entry.finalPosition,
      points: entry.points,
      matchesPlayed: entry.matchesPlayed,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      goalsFor: entry.goalsFor,
      goalsAgainst: entry.goalsAgainst,
      goalDifference: entry.goalsFor - entry.goalsAgainst,
      registeredAt: entry.registeredAt.toISOString(),
      team: entry.team,
      division: entry.division
        ? { id: entry.division.id, name: entry.division.name, label: DIVISION_LABELS[entry.division.name] }
        : null,
    };
  }
}
