import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { PortalPageComponent } from '@onecx/angular-utils'

import { LabelResolver } from 'src/app/shared/label.resolver'

import { AppSearchComponent } from './app-search/app-search.component'
import { AppDetailComponent } from './app-detail/app-detail.component'
import { RoleDetailComponent } from './role-detail/role-detail.component'
import { RoleDeleteComponent } from './role-delete/role-delete.component'
import { RoleIdmComponent } from './role-idm/role-idm.component'
import { PermissionDeleteComponent } from './permission-delete/permission-delete.component'
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
  imports: [
    CommonModule,
    FormsModule,
    AngularAcceleratorModule,
    PortalPageComponent,
    AppSearchComponent,
    AppDetailComponent,
    RoleDetailComponent,
    RoleDeleteComponent,
    RoleIdmComponent,
    PermissionDeleteComponent,
    PermissionDetailComponent,
    PermissionExportComponent,
    RouterModule.forChild(routes)
  ],
  providers: [LabelResolver]
})
export class PermissionModule {
  constructor() {
    console.info('Permission Module constructor')
  }
}
