import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_COVER_SIZE = 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

@Injectable()
export class StorageService {
  private readonly useS3: boolean;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly localDir: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const accessKey = this.config.get<string>('S3_ACCESS_KEY');
    const secretKey = this.config.get<string>('S3_SECRET_KEY');
    this.bucket = this.config.get<string>('S3_BUCKET', 'pitchzone-uploads');
    this.useS3 = Boolean(endpoint && accessKey && secretKey);
    this.publicBaseUrl = this.config.get<string>(
      'STORAGE_PUBLIC_URL',
      `http://localhost:${this.config.get('PORT', 4000)}/api/uploads`,
    );
    this.localDir = join(process.cwd(), 'uploads');
  }

  validateProofFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Загрузите пруф (скриншот или видео)');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Файл не должен превышать 10 МБ');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Допустимы изображения (JPEG, PNG, WebP, GIF) и видео (MP4, WebM)');
    }
  }

  async uploadMatchProof(
    file: Express.Multer.File,
    tournamentId: string,
    matchId: string,
  ): Promise<string> {
    this.validateProofFile(file);

    const ext = extname(file.originalname) || mimeToExt(file.mimetype);
    const key = `match-proofs/${tournamentId}/${matchId}/${randomUUID()}${ext}`;

    if (this.useS3) {
      return this.uploadToS3(key, file);
    }

    return this.uploadLocally(key, file.buffer);
  }

  validateClubLogo(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Загрузите логотип клуба');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Логотип не должен превышать 10 МБ');
    }
    if (file.mimetype !== 'image/png') {
      throw new BadRequestException('Логотип должен быть в формате PNG');
    }
    if (pngHasAlpha(file.buffer)) {
      throw new BadRequestException(
        'Логотип не должен содержать прозрачный фон — используйте PNG без альфа-канала',
      );
    }
  }

  validateClubCover(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Загрузите обложку клуба');
    }
    if (file.size > MAX_COVER_SIZE) {
      throw new BadRequestException('Обложка не должна превышать 1 МБ');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Обложка: JPEG, PNG или WebP');
    }
  }

  async uploadClubLogo(file: Express.Multer.File, teamId: string): Promise<string> {
    this.validateClubLogo(file);
    const key = `club-logos/${teamId}/${randomUUID()}.png`;
    if (this.useS3) return this.uploadToS3(key, file);
    return this.uploadLocally(key, file.buffer);
  }

  async uploadClubCover(file: Express.Multer.File, teamId: string): Promise<string> {
    this.validateClubCover(file);
    const ext = extname(file.originalname) || mimeToExt(file.mimetype);
    const key = `club-covers/${teamId}/${randomUUID()}${ext}`;
    if (this.useS3) return this.uploadToS3(key, file);
    return this.uploadLocally(key, file.buffer);
  }

  private async uploadLocally(key: string, buffer: Buffer): Promise<string> {
    const filePath = join(this.localDir, key);
    await mkdir(join(this.localDir, key.split('/').slice(0, -1).join('/')), { recursive: true });
    await writeFile(filePath, buffer);
    return `${this.publicBaseUrl}/${key}`;
  }

  private async uploadToS3(key: string, file: Express.Multer.File): Promise<string> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: this.config.get<string>('S3_REGION', 'auto'),
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY')!,
        secretAccessKey: this.config.get<string>('S3_SECRET_KEY')!,
      },
      forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true',
    });

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const publicUrl = this.config.get<string>('S3_PUBLIC_URL');
    if (publicUrl) {
      return `${publicUrl.replace(/\/$/, '')}/${key}`;
    }

    const endpoint = this.config.get<string>('S3_ENDPOINT')!.replace(/\/$/, '');
    return `${endpoint}/${this.bucket}/${key}`;
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };
  return map[mime] ?? '.bin';
}

function pngHasAlpha(buffer: Buffer): boolean {
  if (buffer.length < 26 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new BadRequestException('Некорректный PNG-файл');
  }

  const colorType = buffer[25];
  if (colorType === 4 || colorType === 6) {
    return true;
  }

  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'tRNS') {
      return true;
    }
    if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  return false;
}
