import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TransformationService {
  private readonly logger = new Logger(TransformationService.name);

  async addWatermark(
    file: Express.Multer.File,
    watermarkText: string,
  ): Promise<Buffer> {
    const form = new FormData();

    form.append(
      'fileInput',
      new Blob([file.buffer], {
        type: 'application/pdf',
      }),
      file.originalname,
    );

    form.append('customColor', '#4A5123');
    form.append('watermarkColor', '#4A5123');
    form.append('watermarkType', 'text');
    form.append('watermarkText', watermarkText);
    form.append('alphabet', 'roman');
    form.append('fontSize', '30');
    form.append('rotation', '0');
    form.append('opacity', '0.20');
    form.append('widthSpacer', '250');
    form.append('heightSpacer', '200');

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 120000);

    try {
      const apiKey = process.env.STIRLING_PDF_API_KEY;

      const baseUrl = (
        process.env.STIRLING_PDF_URL ||
        'http://stirling-pdf:8080'
      ).replace(/\/$/, '');

      const url = `${baseUrl}/api/v1/security/add-watermark`;

      this.logger.log(`Enviando PDF a Stirling-PDF: ${url}`);

      const result = await fetch(url, {
        method: 'POST',
        body: form,
        headers: apiKey
          ? {
              'X-API-KEY': apiKey,
            }
          : undefined,
        signal: controller.signal,
      });

      if (!result.ok) {
        const detail = (await result.text()).slice(0, 400);

        this.logger.error(
          `Stirling-PDF respondió ${result.status}: ${detail}`,
        );

        throw new BadGatewayException(
          'No fue posible aplicar la marca de agua al PDF. No se guardó el archivo.',
        );
      }

      const processed = Buffer.from(
        await result.arrayBuffer(),
      );

      if (!processed.length) {
        throw new BadGatewayException(
          'Stirling-PDF devolvió un archivo vacío.',
        );
      }

      this.logger.log(
        `PDF transformado correctamente: ${processed.length} bytes`,
      );

      return processed;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      this.logger.error(
        `Stirling-PDF no disponible: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );

      throw new BadGatewayException(
        'El servicio de protección de PDF no está disponible. No se guardó el archivo.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}