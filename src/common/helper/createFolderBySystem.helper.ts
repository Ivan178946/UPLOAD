import * as fs from 'fs';
import * as path from 'path';
import { FolderBySystemInt } from '../interfaces/documentType.interface';
import { Logger } from '@nestjs/common';

const rootFolder = 'uploads';

export async function createFolderBySystem(options: FolderBySystemInt): Promise<string> {
  const logger = new Logger('createFolder');
  const { folderName, tipo, nombreSistema } = options;

  const folderComponents = [
    rootFolder,
    nombreSistema,
    tipo,
    folderName,
  ].filter(Boolean);

  const folderPath = path.join(...folderComponents);

  try {
    await fs.promises.mkdir(folderPath, { recursive: true });
    logger.log(`Carpeta creada con éxito ${folderPath}`);
    return folderPath;
  } catch (error) {
    console.error(`Error al crear la carpeta ${folderPath}:`, error);
    throw new Error(`No se pudo crear la carpeta: ${error.message}`);
  }
}
