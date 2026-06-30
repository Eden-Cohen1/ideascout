import type { Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';
import type { AppConfigService } from '../../config/config.service';
import { ACCESS_TOKEN_COOKIE } from './auth-cookie.util';

function fakeRes(): Response {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
}

function controllerWith(authResult: { accessToken: string; user: unknown }): {
  controller: AuthController;
  res: Response;
} {
  const auth = {
    register: jest.fn().mockResolvedValue(authResult),
    login: jest.fn().mockResolvedValue(authResult),
  } as unknown as AuthService;
  const users = {} as UsersService;
  const config = { isProduction: false, jwt: { expiresIn: '7d' } } as unknown as AppConfigService;
  return { controller: new AuthController(auth, users, config), res: fakeRes() };
}

describe('AuthController', () => {
  it('sets the access_token cookie on register', async () => {
    const { controller, res } = controllerWith({ accessToken: 'tok', user: { id: 'u1' } });
    await controller.register({ email: 'a@b.com', password: 'password1' }, res);
    expect(res.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'tok',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('sets the access_token cookie on login', async () => {
    const { controller, res } = controllerWith({ accessToken: 'tok', user: { id: 'u1' } });
    await controller.login({ email: 'a@b.com', password: 'password1' }, res);
    expect(res.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'tok',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('still returns accessToken in the response body', async () => {
    const { controller, res } = controllerWith({ accessToken: 'tok', user: { id: 'u1' } });
    const result = await controller.login({ email: 'a@b.com', password: 'password1' }, res);
    expect(result.accessToken).toBe('tok');
  });

  it('logout clears the cookie and returns nothing', () => {
    const { controller, res } = controllerWith({ accessToken: 'tok', user: { id: 'u1' } });
    controller.logout(res);
    expect(res.clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.objectContaining({ httpOnly: true }),
    );
  });
});
