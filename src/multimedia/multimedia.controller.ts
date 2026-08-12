import { Controller, Post, Body, UploadedFiles } from '@nestjs/common';
import { MultimediaService } from './multimedia.service';
import { CreateMultimediaDto } from './dto/create-multimedia.dto';
import { FilesFilter } from 'src/common/decorators/file-filter.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Multimedia')
@Controller('multimedia')
export class MultimediaController {
  constructor(private readonly multimediaService: MultimediaService) {}
  @ApiOperation({ summary: 'Subir archivo al servidor local' })
  @Post('server')
  @FilesFilter('multimedia', 20, ['mp3', 'mp4', 'wav'], CreateMultimediaDto)
  async create(
    @Body() body: CreateMultimediaDto,
    @UploadedFiles()
    multimedia: Array<Express.Multer.File>,
  ) {
    return await this.multimediaService.create(body, multimedia);
  }
}
