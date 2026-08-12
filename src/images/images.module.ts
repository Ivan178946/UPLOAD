import { Logger, Module } from '@nestjs/common';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [MulterModule.register(), ConfigModule],
  controllers: [ImagesController],
  providers: [ImagesService, Logger],
  exports: [ImagesService],
})
export class ImagesModule {}
