# Archivo seguro — Policía Boliviana

Sistema de carga de archivos con una interfaz React, una API NestJS, almacenamiento compatible con S3 en MinIO y procesamiento de PDF mediante Stirling PDF.

Los archivos de cualquier formato se almacenan en un bucket privado. Antes de persistir un PDF, el API lo envía a Stirling PDF y añade la marca de agua diagonal **POLICIA BOLIVIANA**. Si ese procesamiento falla, el PDF se rechaza: nunca se almacena una versión sin marca.

## Arranque con Docker

Se necesita Docker Desktop con Docker Compose v2.

```powershell
Copy-Item .env-example .env
docker compose up --build -d
```

Después de construir las imágenes, abra:

| Servicio | Dirección |
| --- | --- |
| Aplicación React | http://localhost:3000 |
| API | http://localhost:4000/api/files |
| Consola de MinIO | http://localhost:9001 |

El primer inicio de Stirling PDF puede tardar algunos minutos. Consulte su estado con:

```powershell
docker compose ps
docker compose logs -f api stirling-pdf
```

Para detener los servicios conservando los documentos use `docker compose down`. Los datos de MinIO y la configuración de Stirling se guardan en volúmenes Docker. Para borrar los datos de forma irreversible, ejecute `docker compose down -v`.

## Configuración

Antes de usar un entorno compartido, modifique estos valores en `.env`:

- `S3_ACCESS_KEY` y `S3_SECRET_KEY`: credenciales fuertes y exclusivas de MinIO.
- `S3_BUCKET`: nombre del bucket privado.
- `STIRLING_PDF_API_KEY`: opcional cuando se protege Stirling con una clave global.

`S3_ENDPOINT` y `STIRLING_PDF_URL` ya apuntan a los nombres internos de Docker y no deben exponer los servicios en Internet. La interfaz se comunica únicamente con el API; no recibe credenciales S3 ni enlaces públicos de MinIO.

## Flujo de protección

1. React envía de uno a diez archivos, de hasta 50 MB cada uno, al endpoint `POST /api/files`.
2. Para un PDF, NestJS invoca `POST /api/v1/security/add-watermark` de Stirling PDF con el texto `POLICIA BOLIVIANA`.
3. NestJS guarda el resultado (o el archivo no PDF original) en MinIO con un identificador no predecible y metadatos.
4. Las descargas y eliminaciones pasan por el API (`GET` y `DELETE /api/files/:id`); el puerto S3 de MinIO no se publica.

La lista de archivos está disponible en `GET /api/files`. La documentación interactiva de Swagger se habilita cuando `NODE_ENV=development`, en `http://localhost:4000/api/docs`.

## Desarrollo local

Para ejecutar el frontend sin Docker:

```powershell
Set-Location frontend
npm install
npm run dev
```

Para el backend, cree un `.env` con endpoints accesibles desde el host (por ejemplo `S3_ENDPOINT=http://localhost:9000` y `STIRLING_PDF_URL=http://localhost:8080`), luego:

```powershell
npm install
npm run start:dev
```

## Consideraciones de seguridad

La marca de agua aporta trazabilidad visual, pero no reemplaza control de acceso. Antes de desplegar fuera de una red interna, proteja el API con el mecanismo de autenticación institucional, sitúelo detrás de HTTPS/reverse proxy y gestione las credenciales mediante un secret manager. No publique el puerto S3 (`9000`) ni deje las credenciales de ejemplo en producción.




# ================================== [text](http://localhost:3000)