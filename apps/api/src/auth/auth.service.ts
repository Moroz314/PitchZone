import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthProvider, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { userCanCreateTournaments } from './tournament-permissions';
import { LoginDto, OAuthSyncDto, RegisterDto } from './dto/auth.dto';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    nickname: string;
    avatar: string | null;
    country: string | null;
    countryCode: string | null;
    rating: number;
    role: string;
    canCreateTournaments: boolean;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email уже зарегистрирован');
    }

    const nicknameTaken = await this.prisma.profile.findUnique({
      where: { nickname: dto.nickname },
    });
    if (nicknameTaken) {
      throw new ConflictException('Никнейм уже занят');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        profile: {
          create: {
            nickname: dto.nickname,
            country: dto.country,
            countryCode: dto.countryCode?.toUpperCase(),
          },
        },
        stats: { create: {} },
        accounts: {
          create: {
            provider: AuthProvider.EMAIL,
            providerAccountId: dto.email,
          },
        },
      },
      include: { profile: true, stats: true },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true, stats: true },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.buildAuthResponse(user);
  }

  async oauthSync(dto: OAuthSyncDto): Promise<AuthResponse> {
    const existingAccount = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
        },
      },
      include: {
        user: { include: { profile: true, stats: true } },
      },
    });

    if (existingAccount) {
      return this.buildAuthResponse(existingAccount.user);
    }

    let user = dto.email
      ? await this.prisma.user.findUnique({
          where: { email: dto.email },
          include: { profile: true, stats: true },
        })
      : null;

    if (user) {
      await this.prisma.account.create({
        data: {
          userId: user.id,
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
        },
      });
      return this.buildAuthResponse(user);
    }

    const nickname = await this.generateUniqueNickname(
      dto.nickname ?? `player_${dto.providerAccountId.slice(0, 8)}`,
    );
    const email =
      dto.email ?? `${dto.provider.toLowerCase()}_${dto.providerAccountId}@pitchzone.local`;

    user = await this.prisma.user.create({
      data: {
        email,
        emailVerified: dto.email ? new Date() : null,
        profile: {
          create: {
            nickname,
            avatar: dto.avatar,
          },
        },
        stats: { create: {} },
        accounts: {
          create: {
            provider: dto.provider,
            providerAccountId: dto.providerAccountId,
          },
        },
      },
      include: { profile: true, stats: true },
    });

    return this.buildAuthResponse(user);
  }

  async validateToken(token: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { profile: true, stats: true },
      });
      if (!user?.profile) {
        throw new UnauthorizedException('Пользователь не найден');
      }
      return this.buildAuthResponse(user);
    } catch {
      throw new UnauthorizedException('Недействительный токен');
    }
  }

  getSteamAuthUrl(returnUrl: string): string {
    const realm = this.configService.get<string>('STEAM_REALM', 'http://localhost:4000');
    const returnTo = `${realm}/api/auth/steam/callback?returnUrl=${encodeURIComponent(returnUrl)}`;

    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnTo,
      'openid.realm': realm,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    return `https://steamcommunity.com/openid/login?${params.toString()}`;
  }

  async handleSteamCallback(query: Record<string, string>): Promise<AuthResponse> {
    const claimedId = query['openid.claimed_id'];
    if (!claimedId) {
      throw new UnauthorizedException('Steam authentication failed');
    }

    const steamIdMatch = claimedId.match(/(\d{17})$/);
    if (!steamIdMatch) {
      throw new UnauthorizedException('Invalid Steam ID');
    }

    const steamId = steamIdMatch[1];
    let nickname = `steam_${steamId.slice(-6)}`;
    let avatar: string | undefined;

    const steamApiKey = this.configService.get<string>('STEAM_API_KEY');
    if (steamApiKey) {
      try {
        const res = await fetch(
          `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamApiKey}&steamids=${steamId}`,
        );
        const data = (await res.json()) as {
          response: { players: { personaname: string; avatarfull: string }[] };
        };
        const player = data.response?.players?.[0];
        if (player) {
          nickname = player.personaname;
          avatar = player.avatarfull;
        }
      } catch {
        // fallback to default nickname
      }
    }

    return this.oauthSync({
      provider: AuthProvider.STEAM,
      providerAccountId: steamId,
      nickname,
      avatar,
    });
  }

  private async generateUniqueNickname(base: string): Promise<string> {
    const sanitized = base.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20);
    let nickname = sanitized;
    let counter = 1;

    while (await this.prisma.profile.findUnique({ where: { nickname } })) {
      nickname = `${sanitized}_${counter++}`;
    }

    return nickname;
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    role: string;
    canCreateTournaments: boolean;
    profile: { nickname: string; avatar: string | null; country: string | null; countryCode: string | null } | null;
    stats: { rating: number } | null;
  }): AuthResponse {
    if (!user.profile) {
      throw new UnauthorizedException('Профиль не найден');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.profile.nickname,
        avatar: user.profile.avatar,
        country: user.profile.country,
        countryCode: user.profile.countryCode,
        rating: user.stats?.rating ?? 1200,
        role: user.role,
        canCreateTournaments: userCanCreateTournaments({
          role: user.role as UserRole,
          canCreateTournaments: user.canCreateTournaments,
        }),
      },
    };
  }
}
