import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportScoreDto } from './dto/report-score.dto';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.matchesService.findById(id);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  startMatch(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.matchesService.startMatch(id, user.id);
  }

  @Post(':id/report-score')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
  @UseInterceptors(
    FileInterceptor('proof', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  reportScore(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ReportScoreDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.matchesService.reportScore(id, user.id, dto.score1, dto.score2, file);
  }
}
