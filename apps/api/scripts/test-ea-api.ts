/**
 * Smoke-test EA Pro Clubs API (12.7.1).
 * Usage: npm run test:ea-api -- [clubId] [clubNameSearch]
 */
import { EaProClubsStatsProvider } from '../src/ea-sync/providers/ea-pro-clubs.provider';
import { EaClubPlatform } from '@prisma/client';

const EA_BASE = 'https://proclubs.ea.com/api/fc';

async function searchClub(name: string) {
  const url = new URL(`${EA_BASE}/allTimeLeaderboard/search`);
  url.searchParams.set('platform', 'common-gen5');
  url.searchParams.set('clubName', name);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    console.error('Search failed', res.status);
    return null;
  }

  return res.json();
}

async function main() {
  const clubIdArg = process.argv[2];
  const searchName = process.argv[3] ?? 'Virtual Pro';

  const provider = new EaProClubsStatsProvider();

  let clubId = clubIdArg;
  if (!clubId) {
    console.log(`Searching EA clubs by name: "${searchName}"...`);
    const results = await searchClub(searchName);
    const first = Array.isArray(results) ? results[0] : null;
    clubId = first?.clubId ?? first?.clubInfo?.clubId;
    if (!clubId) {
      console.error('No club found. Pass club ID: npm run test:ea-api -- 123456');
      process.exit(1);
    }
    console.log(`Using club: ${first?.clubName ?? clubId} (id=${clubId})`);
  }

  console.log(`\nFetching matches for EA club ${clubId}...`);
  const matches = await provider.fetchClubMatches(String(clubId), EaClubPlatform.PC);
  console.log(`Found ${matches.length} matches in EA history`);

  if (matches.length > 0) {
    const latest = matches[0];
    console.log('\nLatest match:');
    console.log(JSON.stringify(latest, null, 2));

    const players = await provider.fetchMatchPlayerStats(latest.matchId, String(clubId), EaClubPlatform.PC);
    console.log(`\nPlayers in latest match: ${players.length}`);
    console.log(JSON.stringify(players.slice(0, 5), null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
