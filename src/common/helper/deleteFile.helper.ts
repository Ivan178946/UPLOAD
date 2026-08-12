import * as fs from 'fs';
export function deleteFile(pathFile: string) {
  if (fs.existsSync(pathFile)) {
    fs.unlinkSync(pathFile);
    return `Archivo borrado con éxito: ${pathFile}`;
  }
}
