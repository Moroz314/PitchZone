import { BadRequestException, Injectable } from '@nestjs/common';

const GAMERTAG_PATTERN = /^[A-Za-z0-9 _-]{3,16}$/;

@Injectable()
export class GamertagValidatorService {
  validate(gamerTag: string): { valid: boolean; normalized: string; warnings: string[] } {
    const normalized = gamerTag.trim();
    const warnings: string[] = [];

    if (normalized.length < 3 || normalized.length > 16) {
      throw new BadRequestException('Геймертег должен быть от 3 до 16 символов');
    }

    if (!GAMERTAG_PATTERN.test(normalized)) {
      throw new BadRequestException(
        'Геймертег может содержать только латинские буквы, цифры, пробел, _ и -',
      );
    }

    if (normalized !== gamerTag) {
      warnings.push('Убраны лишние пробелы по краям');
    }

    if (/\s{2,}/.test(normalized)) {
      warnings.push('Избегайте двойных пробелов — в EA FC ник должен совпадать точно');
    }

    warnings.push(
      'Геймертег должен точно совпадать с ником в EA FC (режим Клубы). Несовпадение может привести к санкциям на официальном матче.',
    );

    return { valid: true, normalized, warnings };
  }
}
