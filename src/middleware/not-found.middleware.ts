import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class NotFoundMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { url, method } = req;
    const message = `Ruta ${method} ${url} no encontrada`;

    next(new NotFoundException(message));
  }
}
