// src/common/helper/saveFile.helper.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { generateUniqueId } from './generateUniqueId';
import { Logger } from '@nestjs/common';

export interface SaveFileResult {
  mensaje: string;
  url: string;
  uniqueId: string;
}

export async function saveFile(
  file: Express.Multer.File,
  folderPath: string,
  logger: Logger,
): Promise<SaveFileResult> {
  const fileExtName = path.extname(file.originalname);
  const uniqueId = generateUniqueId();
  const fileName = `${uniqueId}${fileExtName}`;
  const filePath = path.join(folderPath, fileName);

  logger.log(`Procesando archivo: ${fileName}`);

  try {
    await fs.writeFile(filePath, file.buffer);
    logger.log(`Archivo procesado y guardado con éxito: ${filePath}`);
    return {
      mensaje: 'Se guardó el archivo correctamente',
      url: filePath,
      uniqueId,
    };
  } catch (error) {
    logger.error(`Error al guardar el archivo ${fileName}: ${error.message}`);
    throw new Error(`No se pudo guardar el archivo ${fileName}`);
  }
}
