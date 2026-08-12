import { Logger, Module } from '@nestjs/common';
import { MultimediaService } from './multimedia.service';
import { MultimediaController } from './multimedia.controller';

@Module({
  controllers: [MultimediaController],
  providers: [MultimediaService, Logger],
})
export class MultimediaModule {}
