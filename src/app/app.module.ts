import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { RouterModule, Routes } from '@angular/router'
import { BrowserModule } from '@angular/platform-browser'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { TranslateLoader, TranslateModule, MissingTranslationHandler } from '@ngx-translate/core'

import { AngularAcceleratorMissingTranslationHandler, AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { AngularAuthModule } from '@onecx/angular-auth'
import { StandaloneShellModule, provideStandaloneProviders } from '@onecx/angular-standalone-shell'
import {
  createTranslateLoader,
  providePermissionService,
  provideThemeConfig,
  provideTranslationPathFromMeta
} from '@onecx/angular-utils'
import { APP_CONFIG } from '@onecx/angular-integration-interface'

import { environment } from 'src/environments/environment'
import { AppComponent } from './app.component'

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./permission/permission.module').then((m) => m.PermissionModule)
  }
]
@NgModule({
  bootstrap: [AppComponent],
  imports: [
    AppComponent,
    CommonModule,
    BrowserModule,
    BrowserAnimationsModule,
    AngularAuthModule,
    AngularAcceleratorModule,
    StandaloneShellModule,
    RouterModule.forRoot(routes, {
      initialNavigation: 'enabledBlocking',
      enableTracing: true
    }),
    TranslateModule.forRoot({
      isolate: true,
      loader: { provide: TranslateLoader, useFactory: createTranslateLoader, deps: [HttpClient] },
      missingTranslationHandler: {
        provide: MissingTranslationHandler,
        useClass: AngularAcceleratorMissingTranslationHandler
      }
    })
  ],
  providers: [
    { provide: APP_CONFIG, useValue: environment },
    provideTranslationPathFromMeta(import.meta.url, 'assets/i18n/'),
    provideThemeConfig(),
    provideStandaloneProviders(),
    providePermissionService(),
    provideHttpClient(withInterceptorsFromDi())
  ]
})
export class AppModule {
  constructor() {
    console.info('OneCX Permission Module constructor')
  }
}
