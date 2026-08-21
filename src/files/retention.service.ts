import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';

/** Frecuencia con la que se revisan los archivos temporales vencidos. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
/** Espera inicial antes de la primera revisión, para no competir con el arranque del sistema. */
const INITIAL_DELAY_MS = 30 * 1000; // 30 segundos

/**
 * Servicio encargado de mantener la privacidad y seguridad de la información:
 * elimina automáticamente, de forma periódica, los archivos que el usuario
 * marcó para almacenamiento TEMPORAL una vez que su plazo de conservación
 * (expiresAt) se ha cumplido. Los archivos marcados como PERMANENTES nunca
 * son tocados por este proceso.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private intervalHandle?: NodeJS.Timeout;
  private initialTimeoutHandle?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly storage: StorageService) {}

  onModuleInit(): void {
    this.initialTimeoutHandle = setTimeout(() => {
      void this.purgeExpiredFiles();
    }, INITIAL_DELAY_MS);

    this.intervalHandle = setInterval(() => {
      void this.purgeExpiredFiles();
    }, CHECK_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.initialTimeoutHandle) clearTimeout(this.initialTimeoutHandle);
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  async purgeExpiredFiles(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let removed = 0;
    try {
      const objects = await this.storage.list();
      const now = Date.now();

      for (const object of objects) {
        try {
          const metadata = await this.storage.metadata(object.key);
          if (metadata.retention !== 'temporary' || !metadata.expiresAt) {
            continue;
          }
          const expiry = new Date(metadata.expiresAt).getTime();
          if (Number.isFinite(expiry) && expiry <= now) {
            await this.storage.remove(object.key);
            removed += 1;
            this.logger.log(
              `Archivo temporal vencido eliminado automáticamente: ${object.key}`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `No se pudo evaluar/depurar el archivo ${object.key}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error al ejecutar la depuración de archivos vencidos: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
    return removed;
  }
}
