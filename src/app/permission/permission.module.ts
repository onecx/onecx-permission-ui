import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { LabelResolver } from 'src/app/shared/label.resolver'

import { AppSearchComponent } from './app-search/app-search.component'
import { AppDetailComponent } from './app-detail/app-detail.component'
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
      breadcrumbFn: (data: { labeli18n: string }) => `${data.labeli18n}`
    },
    resolve: {
      labeli18n: LabelResolver
    }
  }
]
@NgModule({
  imports: [AppSearchComponent, AppDetailComponent, RouterModule.forChild(routes)],
  providers: [LabelResolver]
})
export class PermissionModule {
  constructor() {
    console.info('Permission Module constructor')
  }
}
