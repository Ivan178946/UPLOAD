<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

## Descripción

Servidor para almacenamiento de archivos como Imagenes y Documentos PDF

## Instrucciones de Uso

1. Clonar el repositorio
2. Instalar las dependencias del proyecto ```npm install```
3. Clonar el archivo .env-example a .env y configurar las variables de entorno, en caso de necesitar almacenar los archivos en la plataforma cloudinary se debe crear una cuenta en la plataforma de cloudinary con el siguiente link [ir a cloudinary](https://cloudinary.com) y obtener las credenciales para la subida de archivos
4. Para correr el proyecto debe ejecutar el siguiente comando ```npm run start:dev```

## Acceso a la documentacion del Proyecto
Para poder ver la documentación de las rutas del proyecto el entorno del proyecto debe estar en development(desarrollo) porque esta protegido para el entorno de producción

```bash
# El valor deberia estar en development 
NODE_ENV=development

# La url para el acceso es la siguiente
http://localhost:puertoSeteado/api
```
## Licencia

Proyecto realizado por el departamento de desarrollo de Telematica de la Policia Bolivia Nacional