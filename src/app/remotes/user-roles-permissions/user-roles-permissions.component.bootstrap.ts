import { importProvidersFrom } from '@angular/core'
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { MissingTranslationHandler, TranslateLoader } from '@ngx-translate/core'
import { ReplaySubject } from 'rxjs'

import { AngularAcceleratorMissingTranslationHandler } from '@onecx/angular-accelerator'
import { AngularAuthModule } from '@onecx/angular-auth'
import { provideTranslateServiceForRoot } from '@onecx/angular-remote-components'
import {
  createTranslateLoader,
  providePermissionService,
  provideThemeConfig,
  provideTranslationPathFromMeta,
  REMOTE_COMPONENT_CONFIG,
  RemoteComponentConfig
} from '@onecx/angular-utils'
import { bootstrapRemoteComponent } from '@onecx/angular-webcomponents'

import { environment } from 'src/environments/environment'
import { OneCXUserRolesPermissionsComponent } from './user-roles-permissions.component'

bootstrapRemoteComponent(
  OneCXUserRolesPermissionsComponent,
  'ocx-user-roles-permissions-component',
  environment.production,
  [
    provideHttpClient(withInterceptorsFromDi()),
    importProvidersFrom(AngularAuthModule, BrowserAnimationsModule),
    { provide: REMOTE_COMPONENT_CONFIG, useValue: new ReplaySubject<RemoteComponentConfig>(1) },
    providePermissionService(),
    provideThemeConfig(),
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
    provideTranslateServiceForRoot({
      isolate: true,
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      },
      missingTranslationHandler: {
        provide: MissingTranslationHandler,
        useClass: AngularAcceleratorMissingTranslationHandler
      }
    })
  ]
)
