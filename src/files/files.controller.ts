import {
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
      'Los PDF se procesan obligatoriamente con Stirling PDF y se guardan con la marca de agua POLICIA BOLIVIANA.',
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
  ) {
    return this.filesService.upload(files);
  }

  @ApiOperation({ summary: 'Lista los últimos archivos almacenados' })
  @Get()
  list() {
    return this.filesService.list();
  }

  @ApiOperation({
    summary: 'Descarga un archivo desde MinIO a través del API',
    description:
      'Para PDF nuevos, use version=original para descargar la copia sin marca de agua.',
  })
  @Get(':id')
  download(
    @Param('id') id: string,
    @Query('version') version: string | undefined,
    @Res() response: Response,
  ) {
    return this.filesService.download(id, response, version);
  }

  @ApiOperation({ summary: 'Elimina un archivo de MinIO' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.filesService.remove(id);
  }
}
