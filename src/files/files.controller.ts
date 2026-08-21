import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

import { FilesService } from './files.service';

import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';

const MAX_FILES_PER_REQUEST = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const BLOCKED_FILE_EXTENSIONS = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.exe',
  '.html',
  '.htm',
  '.js',
  '.msi',
  '.ps1',
  '.sh',
  '.svg',
]);

@ApiTags('Archivos')
@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
  ) {}

  @ApiOperation({
    summary: 'Sube hasta 10 archivos',
    description:
      'Recibe archivos mediante multipart/form-data. Los archivos PDF pueden procesarse mediante Stirling-PDF para aplicar una marca de agua personalizada antes de almacenarse en MinIO. Los demás formatos se almacenan directamente.',
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
          items: {
            type: 'string',
            format: 'binary',
          },
          description:
            'Archivos que serán procesados y almacenados. Máximo 10 por operación.',
        },

        pdfMode: {
          type: 'string',
          enum: ['original', 'watermarked'],
          default: 'watermarked',
          description:
            'Para PDF: original conserva el archivo sin transformación; watermarked aplica la marca de agua mediante Stirling-PDF.',
        },

        watermarkText: {
          type: 'string',
          maxLength: 120,
          default: 'POLICIA BOLIVIANA',
          description:
            'Texto personalizado de la marca de agua cuando pdfMode=watermarked.',
        },

        retentionMode: {
          type: 'string',
          enum: ['permanent', 'temporary'],
          default: 'permanent',
          description:
            'Define si el archivo tendrá conservación permanente o temporal.',
        },

        retentionDays: {
          type: 'number',
          description:
            'Cantidad de días de conservación cuando retentionMode=temporary.',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Archivos procesados, almacenados en MinIO y rutas de acceso generadas correctamente.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example:
              'YXJjaGl2b3MvMjAyNi0wOC0yMC9mNGJkMzlmMC0yZGQ3LTQ1NTktOWFmYS1lMGRlNDZhZTVlMmUtSVZBTi5wZGY',
            description:
              'Identificador codificado del objeto almacenado.',
          },

          fileName: {
            type: 'string',
            example: 'IVAN.pdf',
            description:
              'Nombre original del archivo.',
          },

          path: {
            type: 'string',
            example:
              'http://localhost:4000/api/files/YXJjaGl2b3Mv...',
            description:
              'Ruta pública del archivo almacenado para descarga.',
          },

          viewUrl: {
            type: 'string',
            example:
              'http://localhost:4000/api/files/YXJjaGl2b3Mv...?disposition=inline',
            description:
              'URL para visualizar el archivo directamente en el navegador.',
          },

          contentType: {
            type: 'string',
            example: 'application/pdf',
          },

          size: {
            type: 'number',
            example: 126303,
          },

          watermarked: {
            type: 'boolean',
            example: true,
          },

          compressed: {
            type: 'boolean',
            example: true,
          },

          retention: {
            type: 'string',
            example: 'permanent',
          },

          duplicate: {
            type: 'boolean',
            example: false,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Cantidad de archivos, parámetros o formato de solicitud no válido.',
  })
  @ApiResponse({
    status: 502,
    description:
      'El servicio Stirling-PDF no está disponible o no pudo procesar el PDF.',
  })
  @Post()
  @UseInterceptors(
    FilesInterceptor(
      'files',
      MAX_FILES_PER_REQUEST,
      {
        storage: memoryStorage(),

        limits: {
          fileSize: MAX_FILE_SIZE,
          files: MAX_FILES_PER_REQUEST,
        },

        fileFilter: (
          _request,
          file,
          callback,
        ) => {
          if (!file.originalname?.trim()) {
            callback(
              new Error(
                'El archivo debe tener un nombre.',
              ),
              false,
            );
            return;
          }

          const extension = file.originalname
            .slice(file.originalname.lastIndexOf('.'))
            .toLowerCase();
          if (BLOCKED_FILE_EXTENSIONS.has(extension)) {
            callback(
              new Error('El tipo de archivo no está permitido.'),
              false,
            );
            return;
          }

          callback(null, true);
        },
      },
    ),
  )
  upload(
    @UploadedFiles()
    files: Array<Express.Multer.File>,

    @Body('pdfMode')
    pdfMode?: string,

    @Body('watermarkText')
    watermarkText?: string,

    @Body('retentionMode')
    retentionMode?: string,

    @Body('retentionDays')
    retentionDays?: string,
  ) {
    if (!files?.length) {
      throw new BadRequestException(
        'Debe seleccionar al menos un archivo.',
      );
    }

    if (
      files.length >
      MAX_FILES_PER_REQUEST
    ) {
      throw new BadRequestException(
        `Solo se permiten hasta ${MAX_FILES_PER_REQUEST} archivos por operación.`,
      );
    }

    return this.filesService.upload(
      files,
      {
        pdfMode,
        watermarkText,
        retentionMode,
        retentionDays,
      },
    );
  }

  @ApiOperation({
    summary:
      'Descarga un archivo duplicado con la marca personalizada.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Archivo temporal generado correctamente.',
  })
  @Get('duplicate/:token')
  downloadDuplicate(
    @Param('token')
    token: string,

    @Res()
    response: Response,
  ) {
    return this.filesService.downloadTemporary(
      token,
      response,
    );
  }

  @ApiOperation({
    summary:
      'Lista los archivos almacenados.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista de archivos almacenados en MinIO.',
  })
  @Get()
  list() {
    return this.filesService.list();
  }

  @ApiOperation({
    summary:
      'Visualiza o descarga un archivo desde MinIO.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Archivo recuperado correctamente.',
  })
  @ApiResponse({
    status: 404,
    description:
      'El archivo solicitado no existe.',
  })
  @Get(':id')
  download(
    @Param('id')
    id: string,

    @Query('disposition')
    disposition: string | undefined,

    @Res()
    response: Response,
  ) {
    return this.filesService.download(
      id,
      response,
      disposition,
    );
  }

  @ApiOperation({
    summary:
      'Elimina un archivo de MinIO.',
  })
  @ApiResponse({
    status: 204,
    description:
      'Archivo eliminado correctamente.',
  })
  @ApiResponse({
    status: 404,
    description:
      'El archivo solicitado no existe.',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id')
    id: string,
  ) {
    return this.filesService.remove(id);
  }
}
