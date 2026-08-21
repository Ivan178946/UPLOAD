import { gzipSync } from 'zlib';

/**
 * Tamaño mínimo (en bytes) a partir del cual vale la pena intentar comprimir.
 * Archivos muy pequeños no se benefician de la compresión y solo agregan
 * procesamiento innecesario.
 */
const MIN_SIZE_TO_COMPRESS = 512;

export interface CompressionResult {
  /** Contenido final que se debe almacenar (comprimido u original). */
  buffer: Buffer;
  /** Indica si el contenido almacenado está comprimido con gzip. */
  compressed: boolean;
  /** Tamaño real/lógico del archivo original, sin comprimir. */
  originalSize: number;
  /** Tamaño del contenido finalmente almacenado. */
  storedSize: number;
}

/**
 * Comprime el contenido de un archivo de cualquier formato utilizando gzip
 * (algoritmo DEFLATE) en su nivel máximo, lo cual es un método de compresión
 * SIN PÉRDIDA (lossless): al descomprimir se obtiene exactamente el mismo
 * archivo, bit a bit, sin ninguna reducción de calidad.
 *
 * Si el resultado comprimido no logra reducir el tamaño (por ejemplo,
 * formatos que ya vienen comprimidos como JPG, MP4 o ZIP), se conserva el
 * archivo original para evitar procesamiento y espacio de almacenamiento
 * innecesarios.
 */
export function compressBuffer(input: Buffer): CompressionResult {
  const originalSize = input.length;

  if (originalSize < MIN_SIZE_TO_COMPRESS) {
    return {
      buffer: input,
      compressed: false,
      originalSize,
      storedSize: originalSize,
    };
  }

  const gzipped = gzipSync(input, { level: 9 });

  if (gzipped.length < originalSize) {
    return {
      buffer: gzipped,
      compressed: true,
      originalSize,
      storedSize: gzipped.length,
    };
  }

  return {
    buffer: input,
    compressed: false,
    originalSize,
    storedSize: originalSize,
  };
}
