import { PartialType } from '@nestjs/swagger';
import { CreateBase64Dto } from './create-base64.dto';

export class UpdateBase64Dto extends PartialType(CreateBase64Dto) {}
