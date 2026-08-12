import { PartialType } from '@nestjs/swagger';
import { CreateMultimediaDto } from './create-multimedia.dto';

export class UpdateMultimediaDto extends PartialType(CreateMultimediaDto) {}
