export enum TipoDocumento {
  imagenes = 'imagenes',
  documentos = 'documentos',
  multimedia = 'multimedia',
}
export interface FolderInt {
  nombreSistema: string;
  folderName: string;
  nroDocumento: string;
  complemento?: string;
  tipo: TipoDocumento;
}

export type FolderBySystemInt = Omit<FolderInt, 'nroDocumento' | 'complemento'>;
