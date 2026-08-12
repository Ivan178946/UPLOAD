import { Injectable, Logger } from '@nestjs/common';
import { CreateBase64Dto } from './dto/create-base64.dto';
import { TipoDocumento } from '../common/interfaces/documentType.interface';
import { createFolder } from '../common/helper/createFolder.helper';
import { saveFile, SaveFileResult } from '../common/helper/saveFile.helper';

@Injectable()
export class Base64Service {
  constructor(private readonly logger: Logger) {}

  async uploadBase64File(
    createBase64Dto: CreateBase64Dto,
  ): Promise<SaveFileResult> {
    const {
      complemento,
      nombreCarpeta,
      nroDocumento,
      nombreSistema,
      fileBase64,
    } = createBase64Dto;

    this.logger.log(
      `Subiendo archivo base64 al servidor Carpeta: ${nombreCarpeta}`,
    );

    try {
      // Crear carpeta
      const folderPath = await createFolder({
        nombreSistema,
        folderName: nombreCarpeta,
        nroDocumento,
        complemento,
        tipo: TipoDocumento.documentos,
      });

      // Preparar archivo para saveFile
      const file = this.createFileFromBase64(fileBase64);

      // Guardar archivo
      return await saveFile(file, folderPath, this.logger);
    } catch (error) {
      this.logger.error(`Error al subir el archivo base64: ${error.message}`);
      throw error;
    }
  }

  private createFileFromBase64(fileBase64: string): Express.Multer.File {
    const [, mimeType] =
      fileBase64.match(/^data:([A-Za-z-+\/]+);base64,/) || [];
    const extension = mimeType.split('/')[1];
    const fileName = `${Date.now()}.${extension}`;
    const base64Data = fileBase64.replace(/^data:[^,]+,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    return {
      buffer,
      originalname: fileName,
      fieldname: 'file',
      encoding: '7bit',
      mimetype: mimeType,
      size: buffer.length,
      stream: null,
      destination: '',
      filename: fileName,
      path: '',
    };
  }
}
