import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { importProvidersFrom } from '@angular/core'
import { OneCXUserRolesPermissionsComponent } from './user-roles-permissions.component'
import { bootstrapRemoteComponent } from '@onecx/angular-webcomponents'
import { AngularAuthModule } from '@onecx/angular-auth'
import { environment } from 'src/environments/environment'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'

bootstrapRemoteComponent(
  OneCXUserRolesPermissionsComponent,
  'ocx-user-roles-permissions-component',
  environment.production,
  [provideHttpClient(withInterceptorsFromDi()), importProvidersFrom(AngularAuthModule, BrowserAnimationsModule)]
)
