import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';

export const multerOptions = {
  storage: diskStorage({
    destination: './uploads',
    filename: (req, file, callback) => {
      const name = file.originalname.split('.')[0];
      const extension = extname(file.originalname);
      const randomName = randomUUID();
      return callback(null, `${name}-${randomName}${extension}`);
    },
  }),
};
