import { useEffect, useRef, useState } from 'react';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;

function readableSize(size) {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const position = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / 1024 ** position).toFixed(position ? 1 : 0)} ${units[position]}`;
}

function messageFrom(response, fallback) {
  return response
    .json()
    .then((payload) => {
      const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message;
      return message || fallback;
    })
    .catch(() => fallback);
}

export default function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [storedFiles, setStoredFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState(null);
  const inputRef = useRef(null);

  const refreshFiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/files');
      if (!response.ok) throw new Error(await messageFrom(response, 'No se pudo consultar el archivo.'));
      setStoredFiles(await response.json());
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshFiles();
  }, []);

  const selectFiles = (incoming) => {
    const candidates = Array.from(incoming || []);
    const tooLarge = candidates.find((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge) {
      setNotice({ type: 'error', text: `${tooLarge.name} supera el límite de 50 MB.` });
      return;
    }
    const chosen = candidates.slice(0, MAX_FILES);
    if (!chosen.length) return;
    setSelectedFiles(chosen);
    setNotice(
      candidates.length > MAX_FILES
        ? { type: 'error', text: `Solo se prepararon los primeros ${MAX_FILES} archivos.` }
        : null,
    );
  };

  const upload = async () => {
    if (!selectedFiles.length || isUploading) return;
    setIsUploading(true);
    setNotice(null);
    const body = new FormData();
    selectedFiles.forEach((file) => body.append('files', file));

    try {
      const response = await fetch('/api/files', { method: 'POST', body });
      if (!response.ok) throw new Error(await messageFrom(response, 'La carga no pudo completarse.'));
      const result = await response.json();
      const protectedCount = result.filter((file) => file.watermarked).length;
      setSelectedFiles([]);
      if (inputRef.current) inputRef.current.value = '';
      setNotice({
        type: 'success',
        text: `${result.length} archivo(s) almacenado(s). ${protectedCount ? `${protectedCount} PDF(s) protegidos con marca de agua.` : ''}`,
      });
      await refreshFiles();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const remove = async (file) => {
    if (!window.confirm(`¿Eliminar «${file.fileName}» de MinIO?`)) return;
    setNotice(null);
    try {
      const response = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await messageFrom(response, 'No se pudo eliminar el archivo.'));
      setStoredFiles((current) => current.filter((item) => item.id !== file.id));
      setNotice({ type: 'success', text: 'Archivo eliminado correctamente.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">PB</div>
        <div>
          <p className="eyebrow">Policía Boliviana</p>
          <h1>Archivo digital seguro</h1>
        </div>
        <div className="system-status"><span /> Sistemas protegidos</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Gestión documental</p>
          <h2>Resguarde archivos.</h2>
          <p className="lead">Los PDF reciben automáticamente la marca de agua <strong>POLICIA BOLIVIANA</strong> antes de guardarse en el repositorio S3 privado.</p>
        </div>
        <div className="protection-card">
          <span className="shield">⌾</span>
          <div><strong>Protección PDF activa</strong><small>Stirling PDF + marca de agua</small></div>
        </div>
      </section>

      <section className="workspace" aria-label="Carga de archivos">
        <div
          className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }}
        >
          <input ref={inputRef} id="file-input" type="file" multiple onChange={(event) => selectFiles(event.target.files)} />
          <div className="upload-symbol" aria-hidden="true">↑</div>
          <h3>Arrastre los archivos aquí</h3>
          <p>o seleccione desde el equipo. Se admiten todos los formatos.</p>
          <label className="secondary-button" htmlFor="file-input">Seleccionar archivos</label>
          <small>Máximo {MAX_FILES} archivos por carga · 50 MB por archivo</small>
        </div>

        <aside className="selection-panel">
          <div className="panel-heading"><h3>Preparados para enviar</h3><span>{selectedFiles.length}/{MAX_FILES}</span></div>
          {selectedFiles.length ? (
            <ul className="selection-list">
              {selectedFiles.map((file) => (
                <li key={`${file.name}-${file.lastModified}`}><span className="file-icon">{file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'FILE'}</span><div><strong>{file.name}</strong><small>{readableSize(file.size)} {file.name.toLowerCase().endsWith('.pdf') && '· se marcará'}</small></div></li>
              ))}
            </ul>
          ) : <p className="empty-state">Aún no hay archivos seleccionados.</p>}
          <button className="primary-button" type="button" onClick={upload} disabled={!selectedFiles.length || isUploading}>
            {isUploading ? 'Procesando y guardando…' : 'Subir al archivo seguro'}
          </button>
        </aside>
      </section>

      {notice && <p className={`notice ${notice.type}`} role="status">{notice.text}</p>}

      <section className="archive-section" aria-label="Archivos almacenados">
        <div className="section-heading"><div><p className="eyebrow">MinIO S3 privado</p><h2>Archivos almacenados</h2></div><button className="icon-button" type="button" onClick={refreshFiles} disabled={isLoading} aria-label="Actualizar lista">↻</button></div>
        {isLoading ? <p className="empty-state">Actualizando el archivo…</p> : storedFiles.length ? (
          <div className="file-table-wrap"><table><thead><tr><th>Archivo</th><th>Protección</th><th>Tamaño</th><th>Fecha</th><th aria-label="Acciones" /></tr></thead><tbody>
            {storedFiles.map((file) => <tr key={file.id}><td><strong>{file.fileName}</strong><small>{file.contentType}</small></td><td>{file.watermarked ? <span className="badge protected">PDF con marca</span> : <span className="badge">Almacenado</span>}</td><td>{readableSize(file.size)}</td><td>{new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(file.uploadedAt))}</td><td className="actions"><a href={file.downloadUrl}>Descargar</a><button type="button" onClick={() => remove(file)}>Eliminar</button></td></tr>)}
          </tbody></table></div>
        ) : <p className="empty-state">No hay archivos en el repositorio todavía.</p>}
      </section>
    </main>
  );
}
