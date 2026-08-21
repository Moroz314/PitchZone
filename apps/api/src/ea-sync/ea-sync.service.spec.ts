import { Test, TestingModule } from '@nestjs/testing';
import { EaClubPlatform } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { EaClubLinkService, ACTIVE_GAME_VERSION } from './ea-club-link.service';
import { EaMatchMatcherService } from './ea-match-matcher.service';
import { EaSyncService } from './ea-sync.service';
import { EaProClubsStatsProvider } from './providers/ea-pro-clubs.provider';
import { StatsService } from '../stats/stats.service';
import { SeasonStandingsService } from '../seasons/season-standings.service';
import { TournamentStatsService } from '../stats/tournament-stats.service';
import { PlayerProfileAggregationService } from '../player-profile/player-profile.service';
import { BracketService } from '../tournaments/bracket.service';
import { TournamentsGateway } from '../tournaments/tournaments.gateway';
import { TournamentsService } from '../tournaments/tournaments.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('EaSyncService', () => {
  let service: EaSyncService;
  let prisma: unknown;
  let notifications: unknown;
  let statsProvider: unknown;

  beforeEach(async () => {
    prisma = {
      eaClubLink: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    notifications = {
      create: jest.fn(),
    };
    statsProvider = {
      verifyClub: jest.fn(),
      fetchClubMatches: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EaSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: EaClubLinkService, useValue: {} },
        { provide: EaMatchMatcherService, useValue: {} },
        { provide: EaProClubsStatsProvider, useValue: statsProvider },
        { provide: StatsService, useValue: {} },
        { provide: SeasonStandingsService, useValue: {} },
        { provide: TournamentStatsService, useValue: {} },
        { provide: PlayerProfileAggregationService, useValue: {} },
        { provide: BracketService, useValue: {} },
        { provide: TournamentsGateway, useValue: {} },
        { provide: TournamentsService, useValue: {} },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<EaSyncService>(EaSyncService);
    // Mock private methods
    (service as unknown as { resolveSystemUserId: jest.Mock }).resolveSystemUserId = jest
      .fn()
      .mockResolvedValue('system-id');
  });

  describe('pollClubLink', () => {
    const mockLink = {
      id: 'link-1',
      teamId: 'team-1',
      eaClubId: '123',
      platform: 'PC' as EaClubPlatform,
      gameVersion: ACTIVE_GAME_VERSION,
      needsReverification: false,
      lastVerifiedClubName: 'Old Name',
      team: {
        members: [{ userId: 'owner-1', role: 'OWNER' }],
      },
    };

    it('should skip processing if needsReverification is true', async () => {
      prisma.eaClubLink.findUnique.mockResolvedValue({
        ...mockLink,
        needsReverification: true,
      });

      const result = { newMatches: 0 } as unknown;
      await (service as unknown as { pollClubLink: (...args: unknown[]) => unknown }).pollClubLink(
        'link-1',
        'team-1',
        '123',
        'PC',
        'sys',
        result,
      );

      expect(prisma.eaClubLink.update).not.toHaveBeenCalled();
      expect(statsProvider.fetchClubMatches).not.toHaveBeenCalled();
      expect(statsProvider.verifyClub).not.toHaveBeenCalled();
    });

    it('should set needsReverification to true and notify if gameVersion changes', async () => {
      prisma.eaClubLink.findUnique.mockResolvedValue({
        ...mockLink,
        gameVersion: 'OLD_VERSION',
      });

      const result = { newMatches: 0 } as unknown;
      await (service as unknown as { pollClubLink: (...args: unknown[]) => unknown }).pollClubLink(
        'link-1',
        'team-1',
        '123',
        'PC',
        'sys',
        result,
      );

      expect(prisma.eaClubLink.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: { needsReverification: true },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({ type: 'EA_CLUB_VERIFICATION_NEEDED' }),
      );
      expect(statsProvider.fetchClubMatches).not.toHaveBeenCalled();
      expect(statsProvider.verifyClub).not.toHaveBeenCalled();
    });
  });
});
