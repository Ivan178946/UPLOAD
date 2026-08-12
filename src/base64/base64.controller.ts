import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Base64Service } from './base64.service';
import { CreateBase64Dto } from './dto/create-base64.dto';

@ApiTags('Base64')
@Controller('base64')
export class Base64Controller {
  constructor(private readonly base64Service: Base64Service) {}

  @ApiOperation({ summary: 'Subir archivo en base64' })
  @ApiResponse({ status: 201, description: 'Archivo subido correctamente' })
  @Post('server')
  async uploadBase64File(@Body() createDto: CreateBase64Dto) {
    try {
      // Validar formato Data URI
      const match = createDto.fileBase64.match(/^data:([A-Za-z-+\/]+);base64,/);
      if (!match) {
        throw new HttpException(
          'Formato de base64 inválido',
          HttpStatus.BAD_REQUEST,
        );
      }

      const mimeType = match[1].toLowerCase();

      // Validar tipo de archivo permitido
      if (!this.isValidMimeType(mimeType)) {
        throw new HttpException(
          'Tipo de archivo no permitido',
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.base64Service.uploadBase64File(createDto);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al procesar el archivo',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private isValidMimeType(mimeType: string): boolean {
    const allowedMimeTypes = [
      // PDF
      'application/pdf',
      // Imágenes
      'image/jpeg',
      'image/jpg',
      'image/png',
      // Multimedia
      'audio/mpeg',
      'audio/wav',
      'video/mp4',
    ];

    return allowedMimeTypes.includes(mimeType);
  }
}
