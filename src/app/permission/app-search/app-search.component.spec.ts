import { NO_ERRORS_SCHEMA } from '@angular/core'
import { HttpClientTestingModule } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { RouterTestingModule } from '@angular/router/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { DataViewModule } from 'primeng/dataview'
import { of } from 'rxjs'

import {
  ApplicationAPIService,
  WorkspaceAPIService,
  WorkspaceAbstract,
  WorkspacePageResult
} from 'src/app/shared/generated'
import { AppSearchComponent } from './app-search.component'
import { HttpResponse } from '@angular/common/http'

const wsAbstract: WorkspaceAbstract = {
  name: 'wsName'
}
const wsAbstract2: WorkspaceAbstract = {
  name: 'wsName2'
}

const wsPageRes: WorkspacePageResult = {
  stream: [wsAbstract, wsAbstract2]
}

describe('AppSearchComponent', () => {
  let component: AppSearchComponent
  let fixture: ComponentFixture<AppSearchComponent>

  const appApiSpy = jasmine.createSpyObj<ApplicationAPIService>('ApplicationAPIService', ['searchApplications'])
  const wsApiSpy = jasmine.createSpyObj<WorkspaceAPIService>('WorkspaceAPIService', ['searchWorkspaces'])

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AppSearchComponent],
      imports: [
        RouterTestingModule,
        HttpClientTestingModule,
        DataViewModule,
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        { provide: ApplicationAPIService, useValue: appApiSpy },
        { provide: WorkspaceAPIService, useValue: wsApiSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents()
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(AppSearchComponent)
    component = fixture.componentInstance
    appApiSpy.searchApplications.and.returnValue(of({}) as any)
    wsApiSpy.searchWorkspaces.and.returnValue(of(new HttpResponse({ body: wsPageRes })))
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })
})
