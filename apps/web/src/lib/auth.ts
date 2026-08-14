import NextAuth, { type NextAuthConfig, type NextAuthResult } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Discord from 'next-auth/providers/discord';

import { loginUser, oauthSync, validateToken } from './api';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      email: string;
      nickname: string;
      avatar: string | null;
      rating: number;
      role?: string;
      canCreateTournaments?: boolean;
    };
  }

  interface User {
    accessToken?: string;
    nickname?: string;
    avatar?: string | null;
    rating?: number;
    role?: string;
    canCreateTournaments?: boolean;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    accessToken?: string;
    id?: string;
    nickname?: string;
    avatar?: string | null;
    rating?: number;
    role?: string;
    canCreateTournaments?: boolean;
  }
}

const providers: NextAuthConfig['providers'] = [
  Credentials({
    id: 'credentials',
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      try {
        const result = await loginUser({
          email: credentials.email as string,
          password: credentials.password as string,
        });
        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.nickname,
          image: result.user.avatar,
          accessToken: result.accessToken,
          nickname: result.user.nickname,
          avatar: result.user.avatar,
          rating: result.user.rating,
          role: result.user.role,
          canCreateTournaments: result.user.canCreateTournaments,
        };
      } catch {
        return null;
      }
    },
  }),
  Credentials({
    id: 'token',
    name: 'Token',
    credentials: {
      token: { label: 'Token', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.token) return null;

      try {
        const result = await validateToken(credentials.token as string);
        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.nickname,
          image: result.user.avatar,
          accessToken: result.accessToken,
          nickname: result.user.nickname,
          avatar: result.user.avatar,
          rating: result.user.rating,
          role: result.user.role,
          canCreateTournaments: result.user.canCreateTournaments,
        };
      } catch {
        return null;
      }
    },
  }),
];

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  providers.push(
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  );
}

const authResult: NextAuthResult = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'discord' && account.providerAccountId) {
        try {
          const discordProfile = profile as {
            username?: string;
            global_name?: string;
            image_url?: string;
            email?: string;
          };
          const result = await oauthSync({
            provider: 'DISCORD',
            providerAccountId: account.providerAccountId,
            email: discordProfile.email ?? user.email ?? undefined,
            nickname:
              discordProfile.global_name ?? discordProfile.username ?? user.name ?? undefined,
            avatar: discordProfile.image_url ?? user.image ?? undefined,
          });

          user.id = result.user.id;
          user.accessToken = result.accessToken;
          user.nickname = result.user.nickname;
          user.avatar = result.user.avatar;
          user.rating = result.user.rating;
          user.role = result.user.role;
          user.canCreateTournaments = result.user.canCreateTournaments;
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.id = user.id;
        token.nickname = user.nickname ?? user.name ?? undefined;
        token.avatar = user.avatar ?? user.image ?? null;
        token.rating = user.rating;
        token.role = user.role;
        token.canCreateTournaments = user.canCreateTournaments;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.accessToken = token.accessToken as string;
        session.user.id = token.id as string;
        session.user.nickname = token.nickname as string;
        session.user.avatar = token.avatar as string | null;
        session.user.rating = token.rating as number;
        session.user.role = token.role as string | undefined;
        session.user.canCreateTournaments = token.canCreateTournaments as boolean | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export const handlers = authResult.handlers;
export const signIn = authResult.signIn;
export const signOut = authResult.signOut;

type AuthFn = NextAuthResult['auth'];
export const auth: AuthFn = authResult.auth;
