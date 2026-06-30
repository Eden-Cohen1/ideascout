import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports an ok status', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok', service: 'ideascout-api' });
  });
});
