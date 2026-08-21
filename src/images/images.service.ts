import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { createReadStream } from 'streamifier';
import { CreateImageBySystem, CreateImageDto } from './dto/create-image.dto';
import * as path from 'path';
import * as sharp from 'sharp';
import { generateUniqueId } from '../common/helper/generateUniqueId';
import { createFolder } from 'src/common/helper/createFolder.helper';
import { TipoDocumento } from 'src/common/interfaces/documentType.interface';
import { DeleteFileDto } from './dto/deleteFile.dto';
import { deleteFile } from 'src/common/helper/deleteFile.helper';
import { createFolderBySystem } from 'src/common/helper/createFolderBySystem.helper';
import { saveFile } from 'src/common/helper/saveFile.helper';

@Injectable()
export class ImagesService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    images: Array<Express.Multer.File>,
    cloudinary_folder: string,
  ) {
    this.logger.log(
      `Subiendo ${images.length} imágenes a Cloudinary Carpeta: ${cloudinary_folder}`,
    );

    const res_promises = images.map(
      (image) =>
        new Promise((resolve, reject) => {
          const upload = cloudinary.uploader.upload_stream(
            {
              folder: cloudinary_folder,
            },
            (error, response) => {
              if (error) {
                this.logger.error(`Error al subir la imagen: ${error}`);
                return reject(error);
              }
              this.logger.log(
                `Imágen subida con éxito: ${response.secure_url}`,
              );
              resolve(response);
            },
          );
          createReadStream(image.buffer).pipe(upload);
        }),
    );
    try {
      const imagesResponse = await Promise.all(res_promises);
      const urls = imagesResponse.map((image: UploadApiResponse) => {
        const url = image.secure_url;
        return { url };
      });
      this.logger.log(
        `Todas las imágenes se subieron con éxito. Regresando las URLs: ${JSON.stringify(urls)}`,
      );
      return JSON.stringify(urls);
    } catch (error) {
      this.logger.error(`Error subiendo Imágenes: ${error}`);
      throw error;
    }
  }

  deleteImage(
    url_image: string,
    cloudinary_folder: string,
  ): Promise<DeleteResponse> {
    const image = url_image.split('/').at(-1);
    const image_name = image.split('.')[0];
    return cloudinary.uploader.destroy(`${cloudinary_folder}/${image_name}`);
  }

  async uploadImageServer(body: CreateImageDto, images: Express.Multer.File[]) {
    const { complemento, nroDocumento, nombreCarpeta, nombreSistema } = body;
    this.logger.log(
      `Subiendo ${images.length} imágenes al servidor Carpeta: ${nombreCarpeta}`,
    );
    try {
      const folderPath = await createFolder({
        nombreSistema,
        folderName: nombreCarpeta,
        nroDocumento,
        complemento,
        tipo: TipoDocumento.imagenes,
      });
      // this.logger.log(`Carpeta creada con éxito ${folderPath}`);

      const saveImagePromises = images.map(async (image) => {
        return await saveFile(image, folderPath, this.logger);
      });
      const results = await Promise.all(saveImagePromises);

      this.logger.log(
        `Todas las imágenes se subieron con éxito. Regresando URLs: ${JSON.stringify(results)}`,
      );
      return results;
    } catch (error) {
      this.logger.error(`Error subiendo las imágenes: ${error}`);
      throw error;
    }
  }

  async uploadImageServerBySystem(
    body: CreateImageBySystem,
    images: Array<Express.Multer.File>,
  ) {
    const { nombreSistema, nombreCarpeta } = body;

    this.logger.log(
      `Subiendo ${images.length} imágenes al servidor Carpeta: ${nombreCarpeta}`,
    );
    try {
      const folderPath = await createFolderBySystem({
        nombreSistema,
        folderName: nombreCarpeta,
        tipo: TipoDocumento.imagenes,
      });
      this.logger.log(`Carpeta creada con éxito ${folderPath}`);

      const saveImagePromises = images.map((image) =>
        this.saveImage(image, folderPath),
      );
      const results = await Promise.all(saveImagePromises);

      this.logger.log(
        `Todas las imágenes se subieron con éxito. Regresando URLs: ${JSON.stringify(results)}`,
      );
      return results;
    } catch (error) {
      this.logger.error(`Error subiendo las imágenes: ${error}`);
      throw error;
    }
  }

  private async saveImage(image: Express.Multer.File, folderPath: string) {
    const uniqueId = generateUniqueId();
    const filename = `${uniqueId}.webp`;
    const fullPath = path.join(folderPath, filename);

    this.logger.log(`Procesando imagen: ${filename}`);

    try {
      await sharp(image.buffer)
        .resize(800)
        .webp({ effort: 3 })
        .toFile(fullPath);

      this.logger.log(`Imagen procesada y guardada con éxito: ${fullPath}`);

      return fullPath;
    } catch (error) {
      this.logger.error(
        `Error al procesar y guardar la imagen ${filename}: ${error.message}`,
      );
      throw new Error(`No se pudo guardar la imagen ${filename}`);
    }
  }
  async deleteImagesServer(body: DeleteFileDto) {
    const { path } = body;
    const urls = JSON.parse(path);
    this.logger.log(`Eliminando ${urls.length} imágenes del servidor`);
    try {
      urls.forEach((url) => {
        this.logger.log(`Borrando Imagen: ${url}`);
        const response = deleteFile(url);
        console.log('response', response);
        if (!response) {
          this.logger.error(`Error al borrar la imagen: ${url} NOT FOUND`);
          throw new Error(`Error al borrar la imagen: ${url} NOT FOUND`);
        }
        this.logger.log(`Imagen borrada con éxito: ${url}`);
      });

      this.logger.log('Se eliminaron todas las imagenes con éxito');
      return {
        mensage: 'Imagenes eliminadas Existosamente',
      };
    } catch (error) {
      this.logger.error(`Error borrando las imagenes: ${error}`);
      throw error;
    }
  }
}
interface DeleteResponse {
  result: string;
}
