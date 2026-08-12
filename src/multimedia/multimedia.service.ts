import { Injectable, Logger } from '@nestjs/common';
import { CreateMultimediaDto } from './dto/create-multimedia.dto';
import { createFolder } from 'src/common/helper/createFolder.helper';
import { TipoDocumento } from 'src/common/interfaces/documentType.interface';
import { saveFile, SaveFileResult } from 'src/common/helper/saveFile.helper';
@Injectable()
@Injectable()
export class MultimediaService {
  private readonly logger = new Logger(MultimediaService.name);

  async create(
    body: CreateMultimediaDto,
    multimedia: Express.Multer.File[],
  ): Promise<SaveFileResult[]> {
    const { complemento, nroDocumento, nombreCarpeta, nombreSistema } = body;
    this.logger.log(
      `Subiendo ${multimedia.length} archivos multimedia al servidor Carpeta: ${nombreCarpeta}`,
    );

    try {
      const folderPath = await createFolder({
        nombreSistema,
        folderName: nombreCarpeta,
        nroDocumento,
        complemento,
        tipo: TipoDocumento.multimedia,
      });
      // this.logger.log(`Carpeta creada con éxito ${folderPath}`);

      const saveFilePromises = multimedia.map(async (file) => {
        return await saveFile(file, folderPath, this.logger);
      });

      const results = await Promise.all(saveFilePromises);

      this.logger.log(
        `Todos los archivos se subieron con éxito. Regresando URLs: ${JSON.stringify(results)}`,
      );
      return results;
    } catch (error) {
      this.logger.error(`Error subiendo los archivos: ${error}`);
      throw error;
    }
  }
}
