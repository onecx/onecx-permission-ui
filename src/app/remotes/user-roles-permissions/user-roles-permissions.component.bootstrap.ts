import { importProvidersFrom } from '@angular/core'
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { provideTranslateService, provideTranslateLoader, provideMissingTranslationHandler } from '@ngx-translate/core'
import { ReplaySubject } from 'rxjs'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { AngularAuthModule } from '@onecx/angular-auth'
import {
  MultiLanguageMissingTranslationHandler,
  OnecxTranslateLoader,
  provideTranslationPathFromMeta,
  REMOTE_COMPONENT_CONFIG,
  RemoteComponentConfig
} from '@onecx/angular-utils'
import { provideThemeConfig } from '@onecx/angular-utils/theme/primeng'
import { bootstrapRemoteComponent } from '@onecx/angular-webcomponents'

import { environment } from 'src/environments/environment'
import { OneCXUserRolesPermissionsComponent } from './user-roles-permissions.component'

bootstrapRemoteComponent(
  OneCXUserRolesPermissionsComponent,
  'ocx-user-roles-permissions-component',
  environment.production,
  [
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: REMOTE_COMPONENT_CONFIG,
      useValue: new ReplaySubject<RemoteComponentConfig>(1)
    },
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
    provideTranslateService({
      defaultLanguage: 'en',
      loader: provideTranslateLoader(OnecxTranslateLoader),
      missingTranslationHandler: provideMissingTranslationHandler(MultiLanguageMissingTranslationHandler)
    }),
    importProvidersFrom(AngularAcceleratorModule, AngularAuthModule, BrowserAnimationsModule),
    provideThemeConfig()
  ]
).catch((err) => console.error(err))
