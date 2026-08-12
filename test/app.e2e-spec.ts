import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { StorageService } from './../src/storage/storage.service';

describe('Files API (e2e)', () => {
  let app: INestApplication;
  let storage: any;

  beforeEach(async () => {
    storage = {
      list: jest.fn().mockResolvedValue([]),
      createKey: jest
        .fn()
        .mockReturnValue('archivos/2026-08-11/id-unico-nota.txt'),
      encodeId: jest.fn().mockReturnValue('identificador-seguro'),
      put: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StorageService)
      .useValue(storage)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/files devuelve una lista vacía inicialmente', () => {
    return request(app.getHttpServer()).get('/api/files').expect(200).expect([]);
  });

  it('POST /api/files acepta un archivo que no es PDF y lo envía a MinIO', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/files')
      .attach('files', Buffer.from('contenido de prueba'), 'nota.txt')
      .expect(201);

    expect(response.body).toEqual([
      expect.objectContaining({
        fileName: 'nota.txt',
        contentType: 'text/plain',
        watermarked: false,
        id: 'identificador-seguro',
      }),
    ]);
    expect(storage.put).toHaveBeenCalledWith(
      'archivos/2026-08-11/id-unico-nota.txt',
      expect.any(Buffer),
      'text/plain',
      expect.objectContaining({ watermarked: 'false' }),
    );
  });
});
