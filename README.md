<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

## Descripción

Servidor para almacenamiento de archivos como Imagenes y Documentos PDF

## Instrucciones de Uso

1. Clonar el repositorio
2. Instalar las dependencias del proyecto `npm ci`
3. Crear el archivo `.env` y configurar las variables de entorno. No subas este archivo al repositorio.
4. Para correr el proyecto debe ejecutar el siguiente comando ```npm run start:dev```

## Acceso a la documentacion del Proyecto
Para poder ver la documentación de las rutas del proyecto el entorno del proyecto debe estar en development(desarrollo) porque esta protegido para el entorno de producción

```bash
# El valor deberia estar en development 
NODE_ENV=development

# La url para el acceso es la siguiente
http://localhost:4000/api/docs
```

## Configuración de seguridad

- En producción define `CORS_ORIGINS` con los dominios autorizados, separados por comas. Por ejemplo: `https://archivos.ejemplo.bo`.
- El endpoint de verificación para Docker es `GET /api/health`.
- Las descargas se entregan como adjunto por defecto; solo PDF, imágenes, audio y video se pueden abrir en el navegador.
## Licencia

Proyecto realizado por el departamento de desarrollo de Telematica de la Policia Bolivia Nacional
