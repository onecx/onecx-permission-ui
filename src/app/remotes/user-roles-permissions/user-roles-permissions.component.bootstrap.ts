import { importProvidersFrom } from '@angular/core'
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'

import { AngularAuthModule } from '@onecx/angular-auth'
import { bootstrapRemoteComponent } from '@onecx/angular-webcomponents'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'

import { environment } from 'src/environments/environment'
import { OneCXUserRolesPermissionsComponent } from './user-roles-permissions.component'

bootstrapRemoteComponent(
  OneCXUserRolesPermissionsComponent,
  'ocx-user-roles-permissions-component',
  environment.production,
  [provideHttpClient(withInterceptorsFromDi()), importProvidersFrom(AngularAuthModule, BrowserAnimationsModule)]
)
