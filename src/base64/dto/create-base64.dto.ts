import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export enum FileType {
  PDF = 'pdf',
  IMAGE = 'image',
  MULTIMEDIA = 'multimedia',
}

export class CreateBase64Dto {
  @ApiProperty()
  @IsNotEmpty({ message: 'El número de documento no puede estar vacío.' })
  @IsString({ message: 'El número de documento debe ser una cadena de texto.' })
  @MinLength(5, {
    message: 'El número de documento debe tener al menos 5 caracteres.',
  })
  nroDocumento: string;

  @ApiProperty()
  @IsOptional()
  @IsString({ message: 'El complemento debe ser una cadena de texto.' })
  complemento: string;

  @ApiProperty()
  @IsNotEmpty({
    message: 'El nombre de la carpeta contendedora es obligatorio',
  })
  @IsString()
  nombreCarpeta: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'El nombre del sistema provieniente es obligatorio' })
  @IsString()
  nombreSistema: string;

  @ApiProperty({
    description: 'Archivo en formato base64',
    example: 'data:application/pdf;base64,JVBERi0xLjcKC...',
  })
  @IsNotEmpty()
  @IsString()
  fileBase64: string;
}
