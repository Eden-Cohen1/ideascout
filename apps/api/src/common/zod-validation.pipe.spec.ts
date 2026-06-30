import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('returns parsed data for valid input', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: 'ok' })).toEqual({ name: 'ok' });
  });

  it('strips unknown keys per the schema', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: 'ok', extra: 1 })).toEqual({ name: 'ok' });
  });

  it('throws BadRequestException for invalid input', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ name: '' })).toThrow(BadRequestException);
  });
});
