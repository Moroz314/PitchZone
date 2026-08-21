import { Logger } from '@nestjs/common';
import { EaSyncService } from '../src/ea-sync/ea-sync.service';
import { ACTIVE_GAME_VERSION } from '../src/ea-sync/ea-club-link.service';

// Minimal mock for Jest functions since Jest is not in dependencies
const jestFn = () => {
  const mockFn: any = function (...args: any[]) {
    mockFn.mock.calls.push(args);
    if (mockFn.mockResolvedValueData !== undefined) {
      return Promise.resolve(mockFn.mockResolvedValueData);
    }
  };
  mockFn.mock = { calls: [] };
  mockFn.mockResolvedValue = (val: any) => { mockFn.mockResolvedValueData = val; return mockFn; };
  mockFn.mockClear = () => { mockFn.mock.calls = []; mockFn.mockResolvedValueData = undefined; };
  return mockFn;
};

async function runTest() {
  const logger = new Logger('Test');
  
  // Mocks
  const prisma = {
    eaClubLink: {
      findUnique: jestFn(),
      update: jestFn(),
    },
  };
  const notifications = {
    create: jestFn(),
  };
  const statsProvider = {
    verifyClub: jestFn(),
    fetchClubMatches: jestFn(),
  };

  const service = new EaSyncService(
    prisma as any,
    {} as any,
    {} as any,
    statsProvider as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    notifications as any
  );
  
  // Expose private method for testing
  const pollClubLink = (service as any).pollClubLink.bind(service);
  
  const mockLinkBase = {
    id: 'link-1',
    teamId: 'team-1',
    eaClubId: '123',
    platform: 'PC',
    gameVersion: ACTIVE_GAME_VERSION,
    needsReverification: false,
    lastVerifiedClubName: 'Old Name',
    team: {
      members: [{ userId: 'owner-1', role: 'OWNER' }],
    },
  };

  logger.log('Running Test 1: skip processing if needsReverification is true');
  prisma.eaClubLink.findUnique.mockResolvedValue({
    ...mockLinkBase,
    needsReverification: true,
  });
  
  await pollClubLink('link-1', 'team-1', '123', 'PC', 'sys', { newMatches: 0 });
  
  if (prisma.eaClubLink.update.mock.calls.length > 0 || statsProvider.fetchClubMatches.mock.calls.length > 0) {
    throw new Error('Test 1 failed: processing was not skipped');
  }

  // Reset mocks
  prisma.eaClubLink.update.mockClear();
  statsProvider.fetchClubMatches.mockClear();
  notifications.create.mockClear();

  logger.log('Running Test 2: set needsReverification to true and notify if gameVersion changes');
  prisma.eaClubLink.findUnique.mockResolvedValue({
    ...mockLinkBase,
    gameVersion: 'OLD_VERSION',
  });

  await pollClubLink('link-1', 'team-1', '123', 'PC', 'sys', { newMatches: 0 });

  if (prisma.eaClubLink.update.mock.calls.length === 0) {
    throw new Error('Test 2 failed: eaClubLink.update was not called');
  }
  const updateArgs = prisma.eaClubLink.update.mock.calls[0][0];
  if (!updateArgs.data.needsReverification) {
    throw new Error('Test 2 failed: needsReverification was not set to true');
  }
  
  if (notifications.create.mock.calls.length === 0) {
    throw new Error('Test 2 failed: notifications.create was not called');
  }

  if (statsProvider.fetchClubMatches.mock.calls.length > 0 || statsProvider.verifyClub.mock.calls.length > 0) {
    throw new Error('Test 2 failed: fetchClubMatches or verifyClub was called');
  }

  logger.log('All tests passed successfully.');
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
