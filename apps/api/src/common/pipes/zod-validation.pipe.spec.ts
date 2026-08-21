import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({
  name: z.string().min(1),
  count: z.coerce.number().int(),
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value when input satisfies the schema', () => {
    expect(pipe.transform({ name: 'checkout', count: '3' })).toEqual({
      name: 'checkout',
      count: 3,
    });
  });

  it('throws BadRequestException when input violates the schema', () => {
    expect(() => pipe.transform({ name: '', count: 'nope' })).toThrow(
      BadRequestException,
    );
  });

  it('reports each offending field path in the response body', () => {
    try {
      pipe.transform({ name: '', count: 'nope' });
      throw new Error('expected the pipe to throw');
    } catch (error) {
      const body = (error as BadRequestException).getResponse() as {
        message: string;
        issues: { path: string; message: string }[];
      };

      expect(body.message).toBe('Validation failed');
      expect(body.issues.map((issue) => issue.path).sort()).toEqual([
        'count',
        'name',
      ]);
    }
  });

  it('rejects unknown payload shapes without throwing a raw ZodError', () => {
    expect(() => pipe.transform(null)).toThrow(BadRequestException);
  });
});
