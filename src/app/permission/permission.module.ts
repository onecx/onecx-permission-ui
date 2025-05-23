import { NO_ERRORS_SCHEMA, NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'

import { PortalCoreModule } from '@onecx/portal-integration-angular'
import { addInitializeModuleGuard, InitializeModuleGuard } from '@onecx/angular-integration-interface'

import { SharedModule } from 'src/app/shared/shared.module'
import { LabelResolver } from 'src/app/shared/label.resolver'

import { AppSearchComponent } from './app-search/app-search.component'
import { AppDetailComponent } from './app-detail/app-detail.component'
import { RoleDetailComponent } from './role-detail/role-detail.component'
import { PermissionDetailComponent } from './permission-detail/permission-detail.component'
import { PermissionExportComponent } from './permission-export/permission-export.component'
import { OneCXUserRolesPermissionsComponent } from 'src/app/remotes/user-roles-permissions/user-roles-permissions.component'

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
      breadcrumbFn: (data: any) => `${data.labeli18n}`
    },
    resolve: {
      labeli18n: LabelResolver
    }
  }
]
@NgModule({
  declarations: [
    AppSearchComponent,
    AppDetailComponent,
    RoleDetailComponent,
    PermissionDetailComponent,
    PermissionExportComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    PortalCoreModule.forMicroFrontend(),
    [RouterModule.forChild(addInitializeModuleGuard(routes))],
    SharedModule
  ],
  providers: [InitializeModuleGuard],
  schemas: [NO_ERRORS_SCHEMA]
})
export class PermissionModule {
  constructor() {
    console.info('Permission Module constructor')
  }
}
