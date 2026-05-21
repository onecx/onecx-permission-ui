import { DoBootstrap, Injector, NgModule, inject, provideAppInitializer } from '@angular/core'
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { BrowserModule } from '@angular/platform-browser'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { RouterModule, Routes, Router } from '@angular/router'
import { TranslateLoader, TranslateModule, MissingTranslationHandler } from '@ngx-translate/core'

import { AngularAcceleratorMissingTranslationHandler, AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { AngularAuthModule } from '@onecx/angular-auth'
import {
  createTranslateLoader,
  PortalApiConfiguration,
  providePermissionService,
  provideThemeConfig,
  provideTranslationPathFromMeta
} from '@onecx/angular-utils'
import { createAppEntrypoint, initializeRouter, startsWith } from '@onecx/angular-webcomponents'
import { AppStateService, ConfigurationService } from '@onecx/angular-integration-interface'

import { Configuration } from './shared/generated'
import { environment } from 'src/environments/environment'
import { AppEntrypointComponent } from './app-entrypoint.component'

function apiConfigProvider() {
  return new PortalApiConfiguration(Configuration, environment.apiPrefix)
}

const routes: Routes = [
  {
    matcher: startsWith(''),
    loadChildren: () => import('./permission/permission.module').then((m) => m.PermissionModule)
  }
]
@NgModule({
  declarations: [AppEntrypointComponent],
  imports: [
    AngularAuthModule,
    BrowserModule,
    BrowserAnimationsModule,
    AngularAcceleratorModule,
    RouterModule.forRoot(routes),
    TranslateModule.forRoot({
      isolate: true,
      loader: { provide: TranslateLoader, useFactory: createTranslateLoader, deps: [HttpClient] },
      missingTranslationHandler: {
        provide: MissingTranslationHandler,
        useClass: AngularAcceleratorMissingTranslationHandler
      }
    })
  ],
  providers: [
    ConfigurationService,
    { provide: Configuration, useFactory: apiConfigProvider },
    provideAppInitializer(() => initializeRouter(inject(Router), inject(AppStateService))()),
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
    providePermissionService(),
    provideThemeConfig(),
    provideHttpClient(withInterceptorsFromDi())
  ]
})
export class OneCXPermissionModule implements DoBootstrap {
  constructor(private readonly injector: Injector) {
    console.info('OneCX Permission Module constructor')
  }

  ngDoBootstrap(): void {
    createAppEntrypoint(AppEntrypointComponent, 'ocx-permission-component', this.injector)
  }
}
