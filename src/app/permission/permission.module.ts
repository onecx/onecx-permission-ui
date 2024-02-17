import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA, NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'

import { addInitializeModuleGuard, InitializeModuleGuard, PortalCoreModule } from '@onecx/portal-integration-angular'
import { SharedModule } from 'src/app/shared/shared.module'
import { LabelResolver } from 'src/app/shared/label.resolver'

import { AppSearchComponent } from './app-search/app-search.component'
import { AppDetailComponent } from './app-detail/app-detail.component'

const routes: Routes = [
  {
    path: '',
    component: AppSearchComponent,
    pathMatch: 'full'
  },
  {
    path: ':type/:appId',
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
  declarations: [AppSearchComponent, AppDetailComponent],
  imports: [
    CommonModule,
    FormsModule,
    PortalCoreModule.forMicroFrontend(),
    [RouterModule.forChild(addInitializeModuleGuard(routes))],
    SharedModule
  ],
  providers: [InitializeModuleGuard],
  schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA]
})
export class PermissionModule {
  constructor() {
    console.info('Permission Module constructor')
  }
}
