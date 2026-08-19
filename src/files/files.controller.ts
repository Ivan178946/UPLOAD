import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode,
  HttpStatus, Param, Post, Query, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesService } from './files.service';
import {
  ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';

const MAX_FILES_PER_REQUEST = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

@ApiTags('Archivos')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @ApiOperation({
    summary: 'Sube hasta 10 archivos a MinIO',
    description:
      'Se pueden subir hasta 10 archivos por operación. Los PDF pueden guardarse originales o con una marca de agua personalizada. Los duplicados no se almacenan nuevamente.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_FILES_PER_REQUEST,
          items: { type: 'string', format: 'binary' },
          description: 'Máximo 10 archivos por operación.',
        },
        pdfMode: {
          type: 'string',
          enum: ['original', 'watermarked'],
          default: 'watermarked',
          description: 'Modo de almacenamiento para los PDF.',
        },
        watermarkText: {
          type: 'string',
          maxLength: 120,
          description: 'Texto personalizado de la marca de agua.',
        },
        retentionMode: {
          type: 'string',
          enum: ['permanent', 'temporary'],
          default: 'permanent',
          description: 'Conservación permanente o temporal.',
        },
        retentionDays: {
          type: 'number',
          description: 'Días de conservación cuando sea temporal.',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Archivos procesados correctamente.' })
  @ApiResponse({ status: 400, description: 'Cantidad de archivos no válida.' })
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES_PER_REQUEST,
      },
      fileFilter: (_request, file, callback) => {
        if (!file.originalname?.trim()) {
          callback(new Error('El archivo debe tener un nombre.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body('pdfMode') pdfMode?: string,
    @Body('watermarkText') watermarkText?: string,
    @Body('retentionMode') retentionMode?: string,
    @Body('retentionDays') retentionDays?: string,
  ) {
    if (!files?.length)
      throw new BadRequestException('Debe seleccionar al menos un archivo.');

    if (files.length > MAX_FILES_PER_REQUEST)
      throw new BadRequestException(
        `Solo se permiten hasta ${MAX_FILES_PER_REQUEST} archivos por operación.`,
      );

    return this.filesService.upload(files, {
      pdfMode,
      watermarkText,
      retentionMode,
      retentionDays,
    });
  }

  @ApiOperation({ summary: 'Descarga un archivo duplicado con la marca personalizada.' })
  @Get('duplicate/:token')
  downloadDuplicate(
    @Param('token') token: string,
    @Res() response: Response,
  ) {
    return this.filesService.downloadTemporary(token, response);
  }

  @ApiOperation({ summary: 'Lista los últimos archivos almacenados.' })
  @Get()
  list() {
    return this.filesService.list();
  }

  @ApiOperation({ summary: 'Visualiza o descarga un archivo desde MinIO.' })
  @Get(':id')
  download(
    @Param('id') id: string,
    @Query('disposition') disposition: string | undefined,
    @Res() response: Response,
  ) {
    return this.filesService.download(id, response, disposition);
  }

  @ApiOperation({ summary: 'Elimina un archivo de MinIO.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.filesService.remove(id);
  }
}