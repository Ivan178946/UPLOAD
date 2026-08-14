import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { StorageService } from './../src/storage/storage.service';
import { Readable } from 'stream';

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
      decodeId: jest
        .fn()
        .mockReturnValue('archivos/2026-08-11/id-unico-documento.pdf'),
      metadata: jest.fn().mockResolvedValue({
        contentType: 'application/pdf',
        originalName: encodeURIComponent('documento.pdf'),
      }),
      get: jest.fn().mockResolvedValue({
        Body: Readable.from(Buffer.from('%PDF-1.4 documento')),
        ContentLength: 18,
      }),
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

  it('GET /api/files/:id permite ver un archivo en línea', async () => {
    await request(app.getHttpServer())
      .get('/api/files/identificador-seguro?disposition=inline')
      .expect('Content-Type', /application\/pdf/)
      .expect('Content-Disposition', /inline; filename\*=UTF-8''documento.pdf/)
      .expect(200);

    expect(storage.get).toHaveBeenCalledWith(
      'archivos/2026-08-11/id-unico-documento.pdf',
    );
  });

  it('POST /api/files guarda un PDF original cuando se solicita sin marca', async () => {
    storage.createKey.mockReturnValueOnce(
      'archivos/2026-08-11/id-unico-original.pdf',
    );

    const response = await request(app.getHttpServer())
      .post('/api/files')
      .field('pdfMode', 'original')
      .attach('files', Buffer.from('%PDF-1.4 contenido de prueba'), 'original.pdf')
      .expect(201);

    expect(response.body).toEqual([
      expect.objectContaining({
        fileName: 'original.pdf',
        contentType: 'application/pdf',
        watermarked: false,
        viewUrl: '/api/files/identificador-seguro?disposition=inline',
      }),
    ]);
    expect(storage.put).toHaveBeenCalledWith(
      'archivos/2026-08-11/id-unico-original.pdf',
      expect.any(Buffer),
      'application/pdf',
      expect.objectContaining({ watermarked: 'false' }),
    );
  });

  it('POST /api/files aplica la marca de agua personalizada solicitada', async () => {
    storage.createKey.mockReturnValueOnce(
      'archivos/2026-08-11/id-unico-protegido.pdf',
    );
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4 protegido').buffer,
    } as Response);

    try {
      const response = await request(app.getHttpServer())
        .post('/api/files')
        .field('pdfMode', 'watermarked')
        .field('watermarkText', 'USO INTERNO')
        .attach('files', Buffer.from('%PDF-1.4 contenido de prueba'), 'protegido.pdf')
        .expect(201);

      expect(response.body).toEqual([
        expect.objectContaining({
          fileName: 'protegido.pdf',
          watermarked: true,
        }),
      ]);
      expect(storage.put).toHaveBeenCalledWith(
        'archivos/2026-08-11/id-unico-protegido.pdf',
        expect.any(Buffer),
        'application/pdf',
        expect.objectContaining({ watermarked: 'true' }),
      );
      const requestOptions = fetchMock.mock.calls[0][1] as RequestInit;
      expect((requestOptions.body as FormData).get('watermarkText')).toBe(
        'USO INTERNO',
      );
    } finally {
      fetchMock.mockRestore();
    }
  });
});
