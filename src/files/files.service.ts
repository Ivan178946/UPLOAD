import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { createHash, randomUUID } from 'crypto';
import { extname } from 'path';
import { Readable } from 'stream';
import { createGunzip } from 'zlib';
import { Response } from 'express';

import { StorageService } from '../storage/storage.service';
import { TransformationService } from './transformation.service';
import { compressBuffer } from '../common/helper/compression.helper';

const WATERMARK_TEXT = 'POLICIA BOLIVIANA';
const MAX_WATERMARK_TEXT_LENGTH = 120;

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650;

const MAX_FILES = 10;
const DUPLICATE_TTL = 5 * 60 * 1000;

type PdfMode = 'original' | 'watermarked';
type RetentionMode = 'permanent' | 'temporary';

interface UploadOptions {
  pdfMode?: string;
  watermarkText?: string;
  retentionMode?: string;
  retentionDays?: string;
}

interface NormalisedUploadOptions {
  pdfMode: PdfMode;
  watermarkText: string;
  retentionMode: RetentionMode;
  expiresAt?: string;
}

interface TemporaryFile {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  expires: number;
}

export interface StoredFile {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  watermarked: boolean;
  path: string;
  downloadUrl: string;
  viewUrl: string;
  compressed: boolean;
  retention: RetentionMode;
  expiresAt?: string;
  duplicate?: boolean;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  private readonly temporaryFiles = new Map<string, TemporaryFile>();

  constructor(
    private readonly storage: StorageService,
    private readonly transformation: TransformationService,
  ) {}

  async upload(
    files: Express.Multer.File[],
    input: UploadOptions = {},
  ): Promise<StoredFile[]> {
    if (!files?.length) {
      throw new BadRequestException('Debe seleccionar al menos un archivo.');
    }

    if (files.length > MAX_FILES) {
      throw new BadRequestException(
        `Solo se permite subir hasta ${MAX_FILES} archivos por operación.`,
      );
    }

    const options = this.normaliseUploadOptions(input);

    try {
      const results = await Promise.all(
        files.map((file) => this.store(file, options)),
      );

      this.logger.log(`Procesados ${results.length} archivos.`);

      return results;
    } catch (error) {
      this.logger.error(
        `Error al subir archivos: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      throw error;
    }
  }

  async list(): Promise<StoredFile[]> {
    const objects = await this.storage.list();

    return Promise.all(
      objects.map(async (object) => {
        const metadata = await this.storage.metadata(object.key);

        const size = metadata.originalSize
          ? Number(metadata.originalSize)
          : object.size;

        return this.toStoredFile(
          object.key,
          this.originalName(object.key, metadata.originalName),
          metadata.contentType || 'application/octet-stream',
          Number.isFinite(size) ? size : object.size,
          object.lastModified?.toISOString() || new Date().toISOString(),
          metadata.watermarked === 'true',
          metadata.compressed === 'true',
          metadata.retention === 'temporary' ? 'temporary' : 'permanent',
          metadata.expiresAt || undefined,
        );
      }),
    );
  }

  async download(
    id: string,
    response: Response,
    disposition?: string,
  ): Promise<void> {
    const key = this.storage.decodeId(id);

    const metadata = await this.storage.metadata(key);

    const object = await this.storage.get(key);

    const fileName = this.originalName(key, metadata.originalName);

    const compressed = metadata.compressed === 'true';

    try {
      const canDisplayInline =
        disposition === 'inline' &&
        this.isSafeInlineContentType(
          metadata.contentType || 'application/octet-stream',
        );

      response.setHeader(
        'Content-Disposition',
        `${
          canDisplayInline ? 'inline' : 'attachment'
        }; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      );

      response.setHeader(
        'Content-Type',
        metadata.contentType || 'application/octet-stream',
      );

      if (!compressed && object.ContentLength) {
        response.setHeader('Content-Length', object.ContentLength);
      } else if (compressed && metadata.originalSize) {
        response.setHeader('Content-Length', metadata.originalSize);
      }

      await new Promise<void>((resolve, reject) => {
        const stream = object.Body as Readable;

        const output = compressed ? stream.pipe(createGunzip()) : stream;

        stream.on('error', reject);
        output.on('error', reject);

        response.on('error', reject);
        response.on('finish', resolve);

        output.pipe(response);
      });
    } catch (error) {
      this.logger.error(
        `Error al descargar ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      if (!response.headersSent) {
        throw new NotFoundException(
          'El archivo no existe o no está disponible.',
        );
      }
    }
  }

  async downloadTemporary(token: string, response: Response): Promise<void> {
    const file = this.temporaryFiles.get(token);

    if (!file || file.expires < Date.now()) {
      this.temporaryFiles.delete(token);

      throw new NotFoundException(
        'La descarga temporal ya no está disponible.',
      );
    }

    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );

    response.setHeader('Content-Type', file.contentType);

    response.setHeader('Content-Length', file.buffer.length);

    response.end(file.buffer);

    this.temporaryFiles.delete(token);
  }

  async remove(id: string): Promise<void> {
    const key = this.storage.decodeId(id);

    const metadata = await this.storage.metadata(key);

    await Promise.all([
      this.storage.remove(key),

      ...(metadata.originalKey
        ? [this.storage.remove(metadata.originalKey)]
        : []),
    ]);
  }

  private async store(
    file: Express.Multer.File,
    options: NormalisedUploadOptions,
  ): Promise<StoredFile> {
    const pdf = this.isPdf(file);

    const watermarked = pdf && options.pdfMode === 'watermarked';

    const sourceSha256 = createHash('sha256').update(file.buffer).digest('hex');

    const fingerprint = createHash('sha256').update(sourceSha256).digest('hex');

    const existing =
      (await this.storage.findBySourceSha256(sourceSha256, false)) ||
      (await this.storage.findBySourceSha256(sourceSha256, true)) ||
      (await this.storage.findByFingerprint(fingerprint));

    if (existing) {
      this.logger.log(`Duplicado detectado: ${file.originalname}`);

      /*
       * El documento ya existe.
       * NO se crea otra copia en MinIO.
       *
       * Si es PDF con marca, generamos
       * una versión temporal con la marca
       * seleccionada por el usuario.
       */

      if (pdf && watermarked) {
        const contents = await this.transformation.addWatermark(
          file,
          options.watermarkText,
        );

        const token = this.createTemporaryFile(
          file.originalname,
          contents,
          'application/pdf',
        );

        return this.toStoredFile(
          existing.key,
          file.originalname,
          'application/pdf',
          contents.length,
          new Date().toISOString(),
          true,
          false,
          'permanent',
          undefined,
          true,
          `/api/files/duplicate/${token}`,
        );
      }

      const size = Number(existing.metadata.originalSize);

      return this.toStoredFile(
        existing.key,
        this.originalName(existing.key, existing.metadata.originalName),
        existing.metadata.contentType ||
          (pdf
            ? 'application/pdf'
            : file.mimetype || 'application/octet-stream'),
        Number.isFinite(size) ? size : file.buffer.length,
        new Date().toISOString(),
        existing.metadata.watermarked === 'true',
        existing.metadata.compressed === 'true',
        existing.metadata.retention === 'temporary' ? 'temporary' : 'permanent',
        existing.metadata.expiresAt || undefined,
        true,
      );
    }

    const legacy = await this.storage.findLegacyVersion(
      file.originalname,
      file.buffer.length,
      watermarked,
    );

    if (legacy) {
      const size = Number(legacy.metadata.originalSize);

      return this.toStoredFile(
        legacy.key,
        this.originalName(legacy.key, legacy.metadata.originalName),
        legacy.metadata.contentType ||
          (pdf
            ? 'application/pdf'
            : file.mimetype || 'application/octet-stream'),
        Number.isFinite(size) ? size : file.buffer.length,
        new Date().toISOString(),
        legacy.metadata.watermarked === 'true',
        legacy.metadata.compressed === 'true',
        legacy.metadata.retention === 'temporary' ? 'temporary' : 'permanent',
        legacy.metadata.expiresAt || undefined,
        true,
      );
    }

    /*
     * Si es PDF con marca de agua,
     * delegamos la transformación a
     * TransformationService.
     *
     * Si no es PDF o se eligió original,
     * conservamos el buffer original.
     */

    const contents = watermarked
      ? await this.transformation.addWatermark(file, options.watermarkText)
      : file.buffer;

    const contentType = pdf
      ? 'application/pdf'
      : file.mimetype || 'application/octet-stream';

    const key = this.storage.createKey(file.originalname);

    /*
     * Compresión antes de almacenar
     * en MinIO.
     */

    const compression = compressBuffer(contents);

    await this.storage.put(key, compression.buffer, contentType, {
      originalName: encodeURIComponent(file.originalname),

      watermarked: String(watermarked),

      compressed: String(compression.compressed),

      originalSize: String(compression.originalSize),

      retention: options.retentionMode,

      expiresAt: options.expiresAt || '',

      sha256: sourceSha256,

      fingerprint,

      watermarkText: watermarked ? options.watermarkText.trim() : '',
    });

    return this.toStoredFile(
      key,
      file.originalname,
      contentType,
      compression.originalSize,
      new Date().toISOString(),
      watermarked,
      compression.compressed,
      options.retentionMode,
      options.expiresAt,
    );
  }

  private createTemporaryFile(
    fileName: string,
    buffer: Buffer,
    contentType: string,
  ): string {
    const token = randomUUID();

    this.temporaryFiles.set(token, {
      buffer,
      fileName,
      contentType,
      expires: Date.now() + DUPLICATE_TTL,
    });

    setTimeout(() => {
      const file = this.temporaryFiles.get(token);

      if (file && file.expires <= Date.now()) {
        this.temporaryFiles.delete(token);
      }
    }, DUPLICATE_TTL + 1000);

    return token;
  }

  private normaliseUploadOptions(
    input: UploadOptions,
  ): NormalisedUploadOptions {
    const pdfMode = input.pdfMode || 'watermarked';

    if (pdfMode !== 'original' && pdfMode !== 'watermarked') {
      throw new BadRequestException(
        'El modo de almacenamiento para PDF no es válido.',
      );
    }

    const watermarkText = (input.watermarkText || WATERMARK_TEXT).trim();

    if (pdfMode === 'watermarked' && !watermarkText) {
      throw new BadRequestException(
        'La marca de agua para PDF no puede estar vacía.',
      );
    }

    if (watermarkText.length > MAX_WATERMARK_TEXT_LENGTH) {
      throw new BadRequestException(
        `La marca de agua no puede superar ${MAX_WATERMARK_TEXT_LENGTH} caracteres.`,
      );
    }

    const retentionMode: RetentionMode =
      input.retentionMode === 'temporary' ? 'temporary' : 'permanent';

    let expiresAt: string | undefined;

    if (retentionMode === 'temporary') {
      const days = Number(input.retentionDays);

      if (
        !Number.isFinite(days) ||
        days < MIN_RETENTION_DAYS ||
        days > MAX_RETENTION_DAYS
      ) {
        throw new BadRequestException(
          `Indique un lapso válido entre ${MIN_RETENTION_DAYS} y ${MAX_RETENTION_DAYS} días.`,
        );
      }

      const expiry = new Date();

      expiry.setDate(expiry.getDate() + days);

      expiresAt = expiry.toISOString();
    }

    return {
      pdfMode,
      watermarkText,
      retentionMode,
      expiresAt,
    };
  }

  private isPdf(file: Express.Multer.File): boolean {
    return (
      file.mimetype === 'application/pdf' ||
      extname(file.originalname).toLowerCase() === '.pdf'
    );
  }

  private isSafeInlineContentType(contentType: string): boolean {
    return (
      contentType === 'application/pdf' ||
      contentType.startsWith('image/') ||
      contentType.startsWith('audio/') ||
      contentType.startsWith('video/')
    );
  }

  private toStoredFile(
    key: string,
    fileName: string,
    contentType: string,
    size: number,
    uploadedAt: string,
    watermarked: boolean,
    compressed: boolean,
    retention: RetentionMode,
    expiresAt?: string,
    duplicate = false,
    customDownloadUrl?: string,
  ): StoredFile {
    const id = this.storage.encodeId(key);

    const apiBaseUrl = (
      process.env.PUBLIC_API_URL || 'http://localhost:4000'
    ).replace(/\/$/, '');

    const downloadUrl = customDownloadUrl || `/api/files/${id}`;

    const path = customDownloadUrl
      ? `${apiBaseUrl}${customDownloadUrl}`
      : `${apiBaseUrl}/api/files/${id}`;

    const viewUrl = customDownloadUrl ? path : `${path}?disposition=inline`;

    return {
      id,
      fileName,
      contentType,
      size,
      uploadedAt,
      watermarked,
      path,
      downloadUrl,
      viewUrl,
      compressed,
      retention,
      expiresAt,
      duplicate,
    };
  }

  private originalName(key: string, encodedName?: string): string {
    if (encodedName) {
      try {
        return decodeURIComponent(encodedName);
      } catch {}
    }

    return key.substring(key.lastIndexOf('-') + 1);
  }
}
