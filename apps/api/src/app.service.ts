import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot() {
    return {
      name: 'PitchZone API',
      version: '0.0.0',
      status: 'ok',
    };
  }
}
