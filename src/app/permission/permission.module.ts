import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA, NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { RouterModule, Routes } from '@angular/router'

import { addInitializeModuleGuard, InitializeModuleGuard, PortalCoreModule } from '@onecx/portal-integration-angular'
import { SharedModule } from '../shared/shared.module'

import { AppSearchComponent } from './app-search/app-search.component'
import { AppDetailComponent } from './app-detail/app-detail.component'

const routes: Routes = [
  {
    path: '',
    component: AppSearchComponent,
    pathMatch: 'full'
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
export class AnnouncementModule {
  constructor() {
    console.info('Permission Module constructor')
  }
}
