import { Logger, Module } from '@nestjs/common';
import { Base64Service } from './base64.service';
import { Base64Controller } from './base64.controller';

@Module({
  controllers: [Base64Controller],
  providers: [Base64Service, Logger],
})
export class Base64Module {}
