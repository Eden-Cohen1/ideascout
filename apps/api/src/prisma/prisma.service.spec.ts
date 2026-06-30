import { PrismaService } from './prisma.service';

// PrismaClient reads the datasource env at construction in some versions.
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';
const svc = new PrismaService();

describe('PrismaService', () => {
  it('exposes Prisma client methods', () => {
    expect(typeof svc.$connect).toBe('function');
    expect(typeof svc.$disconnect).toBe('function');
    expect(typeof svc.$queryRaw).toBe('function');
  });

  it('implements Nest lifecycle hooks', () => {
    expect(typeof svc.onModuleInit).toBe('function');
    expect(typeof svc.onModuleDestroy).toBe('function');
  });
});
