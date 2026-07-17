import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { PortalApiConfiguration, providePermissionService } from '@onecx/angular-utils'
import { AppStateService, ConfigurationService } from '@onecx/angular-integration-interface'

import { LabelResolver } from 'src/app/shared/label.resolver'

import { AppSearchComponent } from './app-search/app-search.component'
import { AppDetailComponent } from './app-detail/app-detail.component'
import { OneCXUserRolesPermissionsComponent } from 'src/app/remotes/user-roles-permissions/user-roles-permissions.component'
import { Configuration } from 'src/app/shared/generated'
import { environment } from 'src/environments/environment'

function apiConfigProvider() {
  return new PortalApiConfiguration(Configuration, environment.apiPrefix)
}

const routes: Routes = [
  {
    path: '',
    component: AppSearchComponent,
    pathMatch: 'full'
  },
  {
    path: 'user',
    component: OneCXUserRolesPermissionsComponent,
    pathMatch: 'full'
  },
  {
    path: ':appType/:appId',
    component: AppDetailComponent,
    data: {
      breadcrumb: 'BREADCRUMBS.DETAIL',
      breadcrumbFn: (data: { labeli18n: string }) => `${data.labeli18n}`
    },
    resolve: {
      labeli18n: LabelResolver
    }
  }
]
@NgModule({
  imports: [AppSearchComponent, AppDetailComponent, RouterModule.forChild(routes)],
  providers: [
    ...providePermissionService(),
    LabelResolver,
    { provide: Configuration, useFactory: apiConfigProvider, deps: [ConfigurationService, AppStateService] }
  ]
})
export class PermissionModule {}
