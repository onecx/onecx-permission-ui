import { NO_ERRORS_SCHEMA } from '@angular/core'
import { HttpClientTestingModule } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { Router } from '@angular/router'
import { ActivatedRoute } from '@angular/router'
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
import { App, AppSearchComponent } from './app-search.component'
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
  let mockActivatedRoute: ActivatedRoute
  let mockRouter = { navigate: jasmine.createSpy('navigate') }

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
        { provide: WorkspaceAPIService, useValue: wsApiSpy },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
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

  /**
   * UI Events
   */
  it('should navigate to detail page when a tile is clicked', () => {
    const app: App = {
      appId: 'appId',
      isApp: true,
      appType: 'APP'
    }
    const product: App = {
      appId: 'appId',
      isApp: true,
      appType: 'PRODUCT'
    }

    component.onAppClick(app)
    expect(mockRouter.navigate).toHaveBeenCalledWith(['./', 'app', app.appId], { relativeTo: undefined })

    component.onAppClick(product)
    expect(mockRouter.navigate).toHaveBeenCalledWith(['./', 'app', app.appId], { relativeTo: undefined })
  })

  it('should update filterBy and filterValue onQuickFilterChange: ALL', () => {
    component.onQuickFilterChange({ value: 'ALL' })

    expect(component.filterBy).toBe(component.filterValueDefault)
    expect(component.filterValue).toBe('')
  })

  it('should update filterBy and filterValue onQuickFilterChange: other', () => {
    component.onQuickFilterChange({ value: 'other' })

    expect(component.filterValue).toBe('other')
    expect(component.filterBy).toBe('appType')
  })

  it('should disable name input field is app type on search is ALL', () => {
    component.onAppTypeFilterChange({ value: 'ALL' })
    expect(component.appSearchCriteriaGroup.controls['name'].disabled).toBeTrue()

    component.onAppTypeFilterChange({ value: 'Apps' })
    expect(component.appSearchCriteriaGroup.controls['name'].enabled).toBeTrue()
  })

  it('should call filter table onFilterChange', () => {
    component.dv = jasmine.createSpyObj('test', ['filter'])

    component.onFilterChange('test')

    expect(component.filter).toBe('test')
    expect(component.dv?.filter).toHaveBeenCalledWith('test', 'contains')
  })

  it('should set correct values onSortChange', () => {
    component.onSortChange('field')

    expect(component.sortField).toEqual('field')
  })

  it('should set correct values onSortDirChange', () => {
    component.onSortDirChange(true)

    expect(component.sortOrder).toEqual(-1)
  })

  it('should set correct values onSortDirChange', () => {
    component.onSortDirChange(false)

    expect(component.sortOrder).toEqual(1)
  })

  it('should searchApps when search button is clicked', () => {
    spyOn(component, 'searchApps')

    component.onSearch()

    expect(component.searchApps).toHaveBeenCalled()
  })

  it('should reset search criteria group and assign empty array to apps observable', (done) => {
    spyOn(component.appSearchCriteriaGroup, 'reset')

    component.onSearchReset()

    expect(component.appSearchCriteriaGroup.reset).toHaveBeenCalledOnceWith({ appType: 'ALL' })
    component.apps$.subscribe({
      next: (res) => {
        if (res) {
          expect(res).toEqual([] as App[])
        }
        done()
      },
      error: done.fail
    })
  })
})
