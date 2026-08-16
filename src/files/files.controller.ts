import {
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

@ApiTags('Archivos')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @ApiOperation({
    summary: 'Sube archivos de cualquier formato a MinIO',
    description:
      'Los PDF pueden guardarse originales o procesarse con una marca de agua personalizada. Los demás formatos se almacenan sin modificaciones.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          maxItems: MAX_FILES_PER_REQUEST,
          items: { type: 'string', format: 'binary' },
        },
        pdfMode: {
          type: 'string',
          enum: ['original', 'watermarked'],
          default: 'watermarked',
          description: 'Modo de almacenamiento para los archivos PDF.',
        },
        watermarkText: {
          type: 'string',
          maxLength: 120,
          description: 'Texto de la marca de agua cuando pdfMode es watermarked.',
        },
        retentionMode: {
          type: 'string',
          enum: ['permanent', 'temporary'],
          default: 'permanent',
          description:
            'Política de conservación: almacenamiento permanente o por un lapso de tiempo definido por el usuario.',
        },
        retentionDays: {
          type: 'number',
          description:
            'Cantidad de días que se conservará el archivo cuando retentionMode es temporary.',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Archivos almacenados correctamente.' })
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_REQUEST },
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
    return this.filesService.upload(files, {
      pdfMode,
      watermarkText,
      retentionMode,
      retentionDays,
    });
  }

  @ApiOperation({ summary: 'Lista los últimos archivos almacenados' })
  @Get()
  list() {
    return this.filesService.list();
  }

  @ApiOperation({
    summary: 'Visualiza o descarga un archivo desde MinIO a través del API',
  })
  @Get(':id')
  download(
    @Param('id') id: string,
    @Query('disposition') disposition: string | undefined,
    @Res() response: Response,
  ) {
    return this.filesService.download(id, response, disposition);
  }

  @ApiOperation({ summary: 'Elimina un archivo de MinIO' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.filesService.remove(id);
  }
}
