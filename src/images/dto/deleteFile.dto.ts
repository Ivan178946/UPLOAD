import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteFileDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  path: string;
}
