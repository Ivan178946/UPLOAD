import { Body, Controller, Delete, Post, UploadedFiles } from '@nestjs/common';
import { ImagesService } from './images.service';
import { CreateImageBySystem, CreateImageDto } from './dto/create-image.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeleteFileDto } from './dto/deleteFile.dto';
import { FilesFilter } from 'src/common/decorators/file-filter.decorator';

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @ApiTags('Imagenes')
  @ApiOperation({ summary: 'Subir archivo al servidor local' })
  @Post('server')
  @FilesFilter('images', 20, ['jpg', 'jpeg', 'png'], CreateImageDto)
  uploadToServer(
    @Body() body: CreateImageDto,
    @UploadedFiles()
    images: Array<Express.Multer.File>,
  ) {
    return this.imagesService.uploadImageServer(body, images);
  }

  @ApiTags('Imagenes')
  @ApiOperation({ summary: 'Subir archivo al servidor local' })
  @Post('server-by-system')
  @FilesFilter('images', 20, ['jpg', 'jpeg', 'png'], CreateImageBySystem)
  uploadToServerBySystem(
    @Body() body: CreateImageBySystem,
    @UploadedFiles()
    images: Array<Express.Multer.File>,
  ) {
    return this.imagesService.uploadImageServerBySystem(body, images);
  }

  @ApiTags('Imagenes')
  @ApiOperation({ summary: 'Subir archivo al servidor de Cloudinary' })
  @Post('cloud')
  @FilesFilter('imagenes', 20, ['jpg', 'jpeg', 'png'])
  uploadToCloudinary(@UploadedFiles() images: Array<Express.Multer.File>) {
    return this.imagesService.uploadImage(images, 'antecedentes');
  }

  @ApiTags('Imagenes')
  @ApiOperation({ summary: 'Eliminar imagenes del servidor local' })
  @Delete('server')
  deleteFile(@Body() body: DeleteFileDto) {
    return this.imagesService.deleteImagesServer(body);
  }
}
