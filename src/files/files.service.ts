import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { extname } from 'path';
import { Readable } from 'stream';
import { Response } from 'express';
import { StorageService } from '../storage/storage.service';

const WATERMARK_TEXT = 'POLICIA BOLIVIANA';

export interface StoredFile {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  watermarked: boolean;
  downloadUrl: string;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(private readonly storage: StorageService) {}

  async upload(files: Express.Multer.File[]): Promise<StoredFile[]> {
    if (!files?.length) {
      throw new BadRequestException('Debe seleccionar al menos un archivo.');
    }

    try {
      const results = await Promise.all(files.map((file) => this.store(file)));
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
        return this.toStoredFile(
          object.key,
          this.originalName(object.key, metadata.originalName),
          metadata.contentType || 'application/octet-stream',
          object.size,
          object.lastModified?.toISOString() || new Date().toISOString(),
          metadata.watermarked === 'true',
        );
      }),
    );
  }

  async download(id: string, response: Response): Promise<void> {
    const key = this.storage.decodeId(id);
    const object = await this.storage.get(key);
    const metadata = await this.storage.metadata(key);
    const fileName = this.originalName(key, metadata.originalName);

    try {
      response.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      );
      response.setHeader(
        'Content-Type', metadata.contentType || 'application/octet-stream');
      if (object.ContentLength) {
        response.setHeader('Content-Length', object.ContentLength);
      }

      await new Promise<void>((resolve, reject) => {
        const stream = object.Body as Readable;
        stream.on('error', reject);
        response.on('error', reject);
        response.on('finish', resolve);
        stream.pipe(response);
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
    await this.storage.remove(key);
  }

  private async store(file: Express.Multer.File): Promise<StoredFile> {
    const pdf = this.isPdf(file);
    const contents = pdf ? await this.addWatermark(file) : file.buffer;
    const contentType = pdf
      ? 'application/pdf'
      : file.mimetype || 'application/octet-stream';
    const key = this.storage.createKey(file.originalname);

    await this.storage.put(key, contents, contentType, {
      originalName: encodeURIComponent(file.originalname),
      watermarked: String(pdf),
    });

    return this.toStoredFile(
      key,
      file.originalname,
      contentType,
      contents.length,
      new Date().toISOString(),
      pdf,
    );
  }

  private async addWatermark(file: Express.Multer.File): Promise<Buffer> {
    const form = new FormData();
    form.append(
      'fileInput',
      new Blob([file.buffer], { type: 'application/pdf' }),
      file.originalname,
    );
    form.append('customColor', '#000000'); 
    form.append('watermarkColor', '#000000');
    form.append('watermarkType', 'text');
    form.append('watermarkText', WATERMARK_TEXT);
    form.append('alphabet', 'roman');
    form.append('fontSize', '44');
    form.append('rotation', '45');
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
  ): StoredFile {
    const id = this.storage.encodeId(key);
    return {
      id,
      fileName,
      contentType,
      size,
      uploadedAt,
      watermarked,
      downloadUrl: `/api/files/${id}`,
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
