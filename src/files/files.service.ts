import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { extname } from 'path';
import { Readable } from 'stream';
import { createGunzip } from 'zlib';
import { Response } from 'express';
import { StorageService } from '../storage/storage.service';
import { compressBuffer } from '../common/helper/compression.helper';

const WATERMARK_TEXT = 'POLICIA BOLIVIANA';
const MAX_WATERMARK_TEXT_LENGTH = 120;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650; // 10 años, límite de seguridad

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

export interface StoredFile {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  watermarked: boolean;
  downloadUrl: string;
  viewUrl: string;
  compressed: boolean;
  retention: RetentionMode;
  expiresAt?: string;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(private readonly storage: StorageService) {}

  async upload(
    files: Express.Multer.File[],
    input: UploadOptions = {},
  ): Promise<StoredFile[]> {
    if (!files?.length) {
      throw new BadRequestException('Debe seleccionar al menos un archivo.');
    }

    const options: NormalisedUploadOptions = this.normaliseUploadOptions(input);

    try {
      const results = await Promise.all(
        files.map((file) => this.store(file, options)),
      );
      this.logger.log(`Se almacenaron ${results.length} archivos en MinIO.`);
      return results;
    } catch (error) {
      this.logger.error(
        `Error al subir archivos: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async list(): Promise<StoredFile[]> {
    const objects = await this.storage.list();
    return Promise.all(
      objects.map(async (object) => {
        const metadata = await this.storage.metadata(object.key);
        // Se muestra siempre el tamaño real del archivo (sin comprimir) para
        // que el usuario vea el tamaño original, aunque en MinIO ocupe menos.
        const displaySize = metadata.originalSize
          ? Number(metadata.originalSize)
          : object.size;
        return this.toStoredFile(
          object.key,
          this.originalName(object.key, metadata.originalName),
          metadata.contentType || 'application/octet-stream',
          Number.isFinite(displaySize) ? displaySize : object.size,
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
    const fileName = this.originalName(key, metadata.originalName);
    const object = await this.storage.get(key);
    const contentDisposition = disposition === 'inline' ? 'inline' : 'attachment';
    const isCompressed = metadata.compressed === 'true';

    try {
      response.setHeader(
        'Content-Disposition',
        `${contentDisposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      );
      response.setHeader(
        'Content-Type', metadata.contentType || 'application/octet-stream');
      // El Content-Length solo se puede fijar de antemano cuando el archivo
      // no requiere descompresión, ya que el tamaño descomprimido difiere
      // del tamaño almacenado.
      if (!isCompressed && object.ContentLength) {
        response.setHeader('Content-Length', object.ContentLength);
      } else if (isCompressed && metadata.originalSize) {
        response.setHeader('Content-Length', metadata.originalSize);
      }

      await new Promise<void>((resolve, reject) => {
        const stream = object.Body as Readable;
        // Si el archivo se guardó comprimido con gzip, se descomprime al
        // vuelo de forma transparente: el usuario siempre recibe el archivo
        // original, bit a bit, sin ninguna pérdida de calidad.
        const output = isCompressed ? stream.pipe(createGunzip()) : stream;
        stream.on('error', reject);
        output.on('error', reject);
        response.on('error', reject);
        response.on('finish', resolve);
        output.pipe(response);
      });
    } catch (error) {
      this.logger.error(
        `Error al descargar ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (!response.headersSent) {
        throw new NotFoundException('El archivo no existe o no está disponible.');
      }
    }
  }

  async remove(id: string): Promise<void> {
    const key = this.storage.decodeId(id);
    const metadata = await this.storage.metadata(key);
    await Promise.all([
      this.storage.remove(key),
      ...(metadata.originalKey ? [this.storage.remove(metadata.originalKey)] : []),
    ]);
  }

  private async store(
    file: Express.Multer.File,
    options: NormalisedUploadOptions,
  ): Promise<StoredFile> {
    const pdf = this.isPdf(file);
    const watermarked = pdf && options.pdfMode === 'watermarked';
    const contents = watermarked
      ? await this.addWatermark(file, options.watermarkText)
      : file.buffer;
    const contentType = pdf
      ? 'application/pdf'
      : file.mimetype || 'application/octet-stream';
    const key = this.storage.createKey(file.originalname);

    // Compresión sin pérdida (lossless) del archivo, sin importar su formato,
    // antes de guardarlo en MinIO. El archivo se descomprime de forma
    // transparente al momento de la descarga, por lo que el usuario nunca
    // percibe ningún cambio ni pérdida de calidad.
    const compression = compressBuffer(contents);

    await this.storage.put(key, compression.buffer, contentType, {
      originalName: encodeURIComponent(file.originalname),
      watermarked: String(watermarked),
      compressed: String(compression.compressed),
      originalSize: String(compression.originalSize),
      retention: options.retentionMode,
      expiresAt: options.expiresAt || '',
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

  private async addWatermark(
    file: Express.Multer.File,
    watermarkText: string,
  ): Promise<Buffer> {
    const form = new FormData();
    form.append(
      'fileInput',
      new Blob([file.buffer], { type: 'application/pdf' }),
      file.originalname,
    );
    form.append('customColor', '#000000'); 
    form.append('watermarkColor', '#000000');
    form.append('watermarkType', 'text');
    form.append('watermarkText', watermarkText);
    form.append('alphabet', 'roman');
    form.append('fontSize', '44');
    form.append('rotation', '0'); 
    form.append('opacity', '0.22');
    form.append('widthSpacer', '80');
    form.append('heightSpacer', '80');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const apiKey = process.env.STIRLING_PDF_API_KEY;
      const result = await fetch(
        `${(process.env.STIRLING_PDF_URL || 'http://stirling-pdf:8080').replace(/\/$/, '')}/api/v1/security/add-watermark`,
        {
          method: 'POST',
          body: form,
          headers: apiKey ? { 'X-API-KEY': apiKey } : undefined,
          signal: controller.signal,
        },
      );

      if (!result.ok) {
        const detail = (await result.text()).slice(0, 400);
        this.logger.error(`Stirling PDF respondió ${result.status}: ${detail}`);
        throw new BadGatewayException(
          'No fue posible aplicar la marca de agua al PDF. No se guardó el archivo.',
        );
      }

      const processed = Buffer.from(await result.arrayBuffer());
      if (!processed.length) {
        throw new BadGatewayException(
          'Stirling PDF devolvió un archivo vacío. No se guardó el archivo.',
        );
      }
      return processed;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      this.logger.error(
        `No se pudo conectar con Stirling PDF: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException(
        'El servicio de protección de PDF no está disponible. No se guardó el archivo.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private normaliseUploadOptions(
    input: UploadOptions,
  ): NormalisedUploadOptions {
    const pdfMode = input.pdfMode || 'watermarked';
    if (pdfMode !== 'original' && pdfMode !== 'watermarked') {
      throw new BadRequestException('El modo de almacenamiento para PDF no es válido.');
    }

    const watermarkText = (input.watermarkText || WATERMARK_TEXT).trim();
    if (pdfMode === 'watermarked' && !watermarkText) {
      throw new BadRequestException('La marca de agua para PDF no puede estar vacía.');
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
          `Indique un lapso de conservación válido, entre ${MIN_RETENTION_DAYS} y ${MAX_RETENTION_DAYS} días.`,
        );
      }
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);
      expiresAt = expiry.toISOString();
    }

    return { pdfMode, watermarkText, retentionMode, expiresAt };
  }

  private isPdf(file: Express.Multer.File): boolean {
    return (
      file.mimetype === 'application/pdf' ||
      extname(file.originalname).toLowerCase() === '.pdf'
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
  ): StoredFile {
    const id = this.storage.encodeId(key);
    const downloadUrl = `/api/files/${id}`;
    return {
      id,
      fileName,
      contentType,
      size,
      uploadedAt,
      watermarked,
      downloadUrl,
      viewUrl: `${downloadUrl}?disposition=inline`,
      compressed,
      retention,
      expiresAt,
    };
  }

  private originalName(key: string, encodedName?: string): string {
    if (encodedName) {
      try {
        return decodeURIComponent(encodedName);
      } catch {
        // Un valor de metadatos corrupto no debe impedir la descarga.
      }
    }
    return key.substring(key.lastIndexOf('-') + 1);
  }
}
