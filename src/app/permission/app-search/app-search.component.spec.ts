import { NO_ERRORS_SCHEMA } from '@angular/core'
import { HttpClientTestingModule } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslateService } from '@ngx-translate/core'
import { RouterTestingModule } from '@angular/router/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { DataViewModule } from 'primeng/dataview'
import { of, throwError } from 'rxjs'

import {
  ApplicationAPIService,
  WorkspaceAPIService,
  WorkspaceAbstract,
  WorkspacePageResult,
  ApplicationPageResult,
  Application
} from 'src/app/shared/generated'
import { App, AppSearchComponent } from './app-search.component'

const wsAbstract: WorkspaceAbstract = {
  name: 'wsName'
}
const wsAbstract2: WorkspaceAbstract = {
  name: 'wsName2'
}

const wsPageRes: WorkspacePageResult = {
  stream: [wsAbstract, wsAbstract2]
}

const app: Application = {
  name: 'appName',
  appId: 'appId',
  productName: 'product'
}

const app2: Application = {
  name: 'appName2',
  appId: 'appId2'
}

const appPageRes: ApplicationPageResult = {
  stream: [app, app2]
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
    appApiSpy.searchApplications.and.returnValue(of(appPageRes) as any)
    wsApiSpy.searchWorkspaces.and.returnValue(of(wsPageRes) as any)
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  /**
   * SEARCH
   */
  it('should search workspaces', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('WORKSPACE')
    component.appSearchCriteriaGroup.controls['name'].setValue('wsName')

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(2)
        apps.forEach((app) => {
          expect(app.appType).toEqual('WORKSPACE')
        })
        done()
      },
      error: done.fail
    })
  })

  it('should search workspaces: empty', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('WORKSPACE')
    wsApiSpy.searchWorkspaces.and.returnValue(of({}) as any)

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(0)
        done()
      },
      error: done.fail
    })
  })

  it('should catch error on searchApps: ws', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('WORKSPACE')
    const err = { status: 404 }
    wsApiSpy.searchWorkspaces.and.returnValue(throwError(() => err))

    component.searchApps()

    component.apps$.subscribe({
      next: (result) => {
        expect(result.length).toBe(0)
        expect(component.exceptionKey).toEqual('EXCEPTIONS.HTTP_STATUS_404.WORKSPACE')
        done()
      },
      error: done.fail
    })
  })

  it('should search products', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('PRODUCT')
    component.appSearchCriteriaGroup.controls['name'].setValue('app')

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(2)
        apps.forEach((app) => {
          expect(app.appType).toEqual('PRODUCT')
        })
        done()
      },
      error: done.fail
    })
  })

  it('should search products without search criteria', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('PRODUCT')
    component.appSearchCriteriaGroup.controls['name'].setValue(null)

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(2)
        apps.forEach((app) => {
          expect(app.appType).toEqual('PRODUCT')
        })
        done()
      },
      error: done.fail
    })
  })

  it('should search apps', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('APP')
    component.appSearchCriteriaGroup.controls['name'].setValue('app')

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(2)
        apps.forEach((app) => {
          expect(app.appType).toEqual('PRODUCT')
        })
        done()
      },
      error: done.fail
    })
  })

  it('should search apps without criteria', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('APP')
    component.appSearchCriteriaGroup.controls['name'].setValue(null)

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(2)
        apps.forEach((app) => {
          expect(app.appType).toEqual('PRODUCT')
        })
        done()
      },
      error: done.fail
    })
  })

  it('should search products with empty appIds', (done) => {
    const app3: Application = {
      name: 'appName3',
      productName: 'product3'
    }
    const app4: Application = {
      name: 'appName4',
      productName: 'product4'
    }
    const appPageRes2: ApplicationPageResult = {
      stream: [app3, app4]
    }
    appApiSpy.searchApplications.and.returnValue(of(appPageRes2 as any))
    component.appSearchCriteriaGroup.controls['appType'].setValue('PRODUCT')
    component.appSearchCriteriaGroup.controls['name'].setValue('app')

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(2)
        apps.forEach((app) => {
          expect(app.appType).toEqual('PRODUCT')
        })
        done()
      },
      error: done.fail
    })
  })

  it('should search products: empty', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('PRODUCT')
    appApiSpy.searchApplications.and.returnValue(of({}) as any)

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(0)
        done()
      },
      error: done.fail
    })
  })

  it('should catch error on searchApps: products', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('PRODUCT')
    const err = { status: 404 }
    appApiSpy.searchApplications.and.returnValue(throwError(() => err))

    component.searchApps()

    component.apps$.subscribe({
      next: (result) => {
        expect(result.length).toBe(0)
        expect(component.exceptionKey).toEqual('EXCEPTIONS.HTTP_STATUS_404.APPS')
        done()
      },
      error: done.fail
    })
  })

  /**
   * Dialog preparation
   */

  it('should prepare translations', () => {
    const translateService = TestBed.inject(TranslateService)
    const generalTranslations = {
      'APP.ID': 'App ID',
      'APP.TYPE': 'App type',
      'ACTIONS.SEARCH.SORT_BY': 'Sort by',
      'ACTIONS.SEARCH.FILTER.LABEL': 'Filter',
      'ACTIONS.SEARCH.FILTER.OF': 'Search filter of',
      'ACTIONS.SEARCH.SORT_DIRECTION_ASC': 'Ascending',
      'ACTIONS.SEARCH.SORT_DIRECTION_DESC': 'Descending'
    }
    spyOn(translateService, 'get').and.returnValues(of(generalTranslations))

    component.ngOnInit()

    expect(component.dataViewControlsTranslations).toEqual({
      sortDropdownPlaceholder: 'Sort by',
      filterInputPlaceholder: 'Filter',
      filterInputTooltip: 'Search filter ofApp ID, App type',
      sortOrderTooltips: {
        ascending: 'Ascending',
        descending: 'Descending'
      },
      sortDropdownTooltip: 'Sort by'
    })
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
