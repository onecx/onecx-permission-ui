import { DoBootstrap, Injector, NgModule, inject, provideAppInitializer } from '@angular/core'
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { RouterModule, Routes, Router } from '@angular/router'
import { provideTranslateService, provideTranslateLoader, provideMissingTranslationHandler } from '@ngx-translate/core'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { AngularAuthModule } from '@onecx/angular-auth'
import { AppStateService, ConfigurationService } from '@onecx/angular-integration-interface'
import {
  MultiLanguageMissingTranslationHandler,
  OnecxTranslateLoader,
  PortalApiConfiguration,
  provideTranslationPathFromMeta
} from '@onecx/angular-utils'
import { provideThemeConfig } from '@onecx/angular-utils/theme/primeng'
import { createAppEntrypoint, initializeRouter, startsWith } from '@onecx/angular-webcomponents'

import { Configuration } from './shared/generated'
import { LabelResolver } from './shared/label.resolver'
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
  imports: [
    AppEntrypointComponent,
    AngularAcceleratorModule,
    AngularAuthModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(routes)
  ],
  providers: [
    LabelResolver,
    ConfigurationService,
    { provide: Configuration, useFactory: apiConfigProvider },
    provideAppInitializer(() => {
      const initializerFn = initializeRouter(inject(Router), inject(AppStateService))
      return initializerFn()
    }),
    provideTranslateService({
      defaultLanguage: 'en',
      loader: provideTranslateLoader(OnecxTranslateLoader),
      missingTranslationHandler: provideMissingTranslationHandler(MultiLanguageMissingTranslationHandler)
    }),
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
    provideHttpClient(withInterceptorsFromDi()),
    provideThemeConfig()
  ]
})
export class OneCXPermissionModule implements DoBootstrap {
  private readonly injector = inject(Injector)

  ngDoBootstrap(): void {
    createAppEntrypoint(AppEntrypointComponent, 'ocx-permission-component', this.injector)
  }
}
