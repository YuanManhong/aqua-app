import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { LocalStorageTankRepository, TankRepository } from './data/tank.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // 抽象类作 DI token,换存储实现只改这一行
    { provide: TankRepository, useExisting: LocalStorageTankRepository }
  ]
};
