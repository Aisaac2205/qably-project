import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC = 'auth:isPublic';

export const Public = (): CustomDecorator<string> =>
  SetMetadata(IS_PUBLIC, true);
