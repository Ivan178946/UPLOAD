import { Module } from '@nestjs/common';

import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { TransformationService } from './transformation.service';

import { StorageModule } from '../storage/storage.module';
import { RetentionService } from './retention.service';

@Module({
  imports: [StorageModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    RetentionService,
    TransformationService,
  ],
})
export class FilesModule {}