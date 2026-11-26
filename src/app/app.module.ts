import { NgModule } from '@angular/core'
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { RouterModule, Routes } from '@angular/router'
import { provideTranslateService, provideTranslateLoader, provideMissingTranslationHandler } from '@ngx-translate/core'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { AngularAuthModule } from '@onecx/angular-auth'
import { APP_CONFIG } from '@onecx/angular-integration-interface'
import { StandaloneShellModule, provideStandaloneProviders } from '@onecx/angular-standalone-shell'
import {
  MultiLanguageMissingTranslationHandler,
  OnecxTranslateLoader,
  provideTranslationPathFromMeta
} from '@onecx/angular-utils'
import { provideThemeConfig } from '@onecx/angular-utils/theme/primeng'

import { environment } from 'src/environments/environment'
import { AppComponent } from './app.component'

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./permission/permission.module').then((m) => m.PermissionModule)
  }
]
@NgModule({
  imports: [
    AppComponent,
    AngularAcceleratorModule,
    AngularAuthModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(routes, {
      initialNavigation: 'enabledBlocking',
      enableTracing: true
    }),
    StandaloneShellModule
  ],
  providers: [
    { provide: APP_CONFIG, useValue: environment },
    provideTranslateService({
      defaultLanguage: 'en',
      loader: provideTranslateLoader(OnecxTranslateLoader),
      missingTranslationHandler: provideMissingTranslationHandler(MultiLanguageMissingTranslationHandler)
    }),
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
    provideHttpClient(withInterceptorsFromDi()),
    provideStandaloneProviders(),
    provideThemeConfig()
  ]
})
export class AppModule {}
