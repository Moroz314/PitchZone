import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto, OAuthSyncDto, RegisterDto, SteamTokenDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('oauth')
  oauthSync(@Body() dto: OAuthSyncDto) {
    return this.authService.oauthSync(dto);
  }

  @Post('validate')
  validateToken(@Body() dto: SteamTokenDto) {
    return this.authService.validateToken(dto.token);
  }

  @Get('steam')
  steamLogin(@Query('returnUrl') returnUrl: string, @Res() res: Response) {
    const url = this.authService.getSteamAuthUrl(
      returnUrl ?? 'http://localhost:3000/auth/callback',
    );
    return res.redirect(url);
  }

  @Get('steam/callback')
  async steamCallback(
    @Query() query: Record<string, string>,
    @Query('returnUrl') returnUrl: string,
    @Res() res: Response,
  ) {
    const auth = await this.authService.handleSteamCallback(query);
    const redirectUrl = new URL(returnUrl ?? 'http://localhost:3000/auth/callback');
    redirectUrl.searchParams.set('token', auth.accessToken);
    redirectUrl.searchParams.set('provider', AuthProvider.STEAM);
    return res.redirect(redirectUrl.toString());
  }
}
