import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';

@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get('kit-templates')
  listKitTemplates() {
    return this.clubsService.listKitTemplates();
  }

  @Get('color-palette')
  getColorPalette() {
    return this.clubsService.getColorPalette();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateClubDto) {
    return this.clubsService.create(user.id, dto);
  }

  @Post(':teamId/logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('logo'))
  uploadLogo(
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.clubsService.uploadLogo(teamId, user.id, file);
  }

  @Post(':teamId/cover')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('cover'))
  uploadCover(
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.clubsService.uploadCover(teamId, user.id, file);
  }
}
