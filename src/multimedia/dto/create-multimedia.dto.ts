import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class CreateMultimediaDto {
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
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Archivos a subir',
  })
  multimedia: any[];
}
