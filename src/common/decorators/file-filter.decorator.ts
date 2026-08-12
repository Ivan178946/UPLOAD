import {
  applyDecorators,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';

export function FilesFilter(
  fieldName: string,
  maxCount: number,
  fileTypes: string[],
  // ✅ Permitir pasar el tipo del DTO
  dtoType?: any,
): MethodDecorator {
  const multerOptions: MulterOptions = {
    fileFilter: (req: any, file: Express.Multer.File, callback) => {
      try {
        console.log(`Procesando archivo: ${file.originalname}`);

        if (!file.originalname) {
          console.error('Nombre de archivo no proporcionado');
          return callback(
            new HttpException(
              'Nombre de archivo no válido',
              HttpStatus.BAD_REQUEST,
            ),
            false,
          );
        }

        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        if (!fileExtension || !fileTypes.includes(fileExtension)) {
          console.error(`Extensión no válida: ${fileExtension}`);
          return callback(
            new HttpException(
              `Solo se permiten archivos ${fileTypes.join(', ')}.`,
              HttpStatus.BAD_REQUEST,
            ),
            false,
          );
        }

        console.log('Archivo validado correctamente');
        callback(null, true);
      } catch (error) {
        console.error('Error en fileFilter:', error);
        callback(
          new HttpException(
            'Error procesando el archivo',
            HttpStatus.INTERNAL_SERVER_ERROR,
          ),
          false,
        );
      }
    },
    limits: {
      fileSize: 1024 * 1024 * 10, // 10 MB
      files: maxCount,
    },
  };

  const decorators = [
    UseInterceptors(FilesInterceptor(fieldName, maxCount, multerOptions)),
    ApiConsumes('multipart/form-data'),
  ];

  // ✅ Solo agregar ApiBody si se proporciona un DTO
  if (dtoType) {
    decorators.push(
      ApiBody({
        description: 'Subir archivos con datos adicionales',
        type: dtoType,
      }) as any,
    );
  } else {
    // ✅ Fallback: solo documentar los archivos
    decorators.push(
      ApiBody({
        schema: {
          type: 'object',
          properties: {
            [fieldName]: {
              type: 'array',
              items: {
                type: 'string',
                format: 'binary',
              },
            },
          },
        },
      }) as any,
    );
  }

  return applyDecorators(...decorators);
}