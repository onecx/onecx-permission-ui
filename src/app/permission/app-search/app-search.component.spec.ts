import { NO_ERRORS_SCHEMA } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { ActivatedRoute, provideRouter, Router } from '@angular/router'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { DataViewModule } from 'primeng/dataview'
import { of, throwError } from 'rxjs'

import {
  ApplicationAPIService,
  WorkspaceAPIService,
  WorkspaceAbstract,
  WorkspacePageResult,
  ApplicationPageResult,
  Application,
  AssignmentAPIService,
  Permission
} from 'src/app/shared/generated'
import { App, AppSearchComponent } from './app-search.component'
import { RowListGridData } from '@onecx/angular-accelerator'
import { FileSelectEvent } from 'primeng/fileupload'
import { PortalMessageService } from '@onecx/angular-integration-interface'

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
  appId: 'appId2',
  productName: 'product'
}

const appPageRes: ApplicationPageResult = {
  stream: [app, app2]
}

const permission: Permission = {
  appId: 'onecx-app',
  productName: 'onecx-product'
}

describe('AppSearchComponent', () => {
  let component: AppSearchComponent
  let fixture: ComponentFixture<AppSearchComponent>
  let mockActivatedRoute: ActivatedRoute
  const mockRouter = { navigate: jasmine.createSpy('navigate') }

  const appApiSpy = jasmine.createSpyObj<ApplicationAPIService>('ApplicationAPIService', ['searchApplications'])
  const assgnmtApiSpy = {
    searchAssignments: jasmine.createSpy('searchAssignments').and.returnValue(of({})),
    importAssignments: jasmine.createSpy('importAssignments').and.returnValue(of({})),
    exportAssignments: jasmine.createSpy('exportAssignments').and.returnValue(of({}))
  }

  const wsApiSpy = jasmine.createSpyObj<WorkspaceAPIService>('WorkspaceAPIService', ['searchWorkspaces'])
  const msgServiceSpy = jasmine.createSpyObj<PortalMessageService>('PortalMessageService', ['success', 'error', 'info'])

  const translateServiceSpy = jasmine.createSpyObj('TranslateService', ['get'])

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AppSearchComponent],
      imports: [
        DataViewModule,
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        provideHttpClientTesting(),
        provideHttpClient(),
        provideRouter([{ path: '', component: AppSearchComponent }]),
        { provide: ApplicationAPIService, useValue: appApiSpy },
        { provide: AssignmentAPIService, useValue: assgnmtApiSpy },
        { provide: WorkspaceAPIService, useValue: wsApiSpy },
        { provide: PortalMessageService, useValue: msgServiceSpy },
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

  afterEach(() => {
    appApiSpy.searchApplications.calls.reset()
    assgnmtApiSpy.searchAssignments.calls.reset()
    assgnmtApiSpy.importAssignments.calls.reset()
    assgnmtApiSpy.exportAssignments.calls.reset()
    wsApiSpy.searchWorkspaces.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should add filters when component is initialized', (done) => {
    component.typeFilterValue$.next('filterValue')
    component.textFilterValue$.next('textFilterValue')

    component.filters$.subscribe({
      next: (filters) => {
        expect(filters).toContain(
          jasmine.objectContaining({ columnId: 'appType', value: 'filterValue', mode: 'equals' })
        )
        expect(filters).toContain(
          jasmine.objectContaining({ columnId: 'displayName', value: 'textFilterValue', mode: 'contains' })
        )
        done()
      }
    })
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
        expect(apps.length).toBe(1)
        apps.forEach((app) => {
          expect(app.appType).toEqual('PRODUCT')
        })
        done()
      },
      error: done.fail
    })
  })

  it('should search products with equals filter', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('PRODUCT')
    component.appSearchCriteriaGroup.controls['name'].setValue('app')
    component.typeFilterValue$.next('filterValue')

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(1)
        apps.forEach((app) => {
          expect(app.appType).toEqual('PRODUCT')
        })
        done()
      },
      error: done.fail
    })
  })

  it('should search products with contains filter', (done) => {
    component.appSearchCriteriaGroup.controls['appType'].setValue('PRODUCT')
    component.appSearchCriteriaGroup.controls['name'].setValue('app')
    component.textFilterValue$.next('textFilterValue')

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(1)
        apps.forEach((app) => {
          expect(app.appType).toEqual('PRODUCT')
        })
        done()
      },
      error: done.fail
    })
  })

  it('should search products with existing product name', (done) => {
    appApiSpy.searchApplications.and.returnValue(
      of({
        stream: [
          {
            name: 'appName3',
            appId: 'appId3',
            productName: 'product2'
          }
        ]
      } as any)
    )

    component.appSearchCriteriaGroup.controls['appType'].setValue('PRODUCT')
    component.appSearchCriteriaGroup.controls['name'].setValue('app')

    component.searchApps()

    component.apps$.subscribe({
      next: (apps) => {
        expect(apps.length).toBe(1)
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
        expect(apps.length).toBe(1)
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
        expect(apps.length).toBe(1)
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
        expect(apps.length).toBe(1)
        apps.forEach((app) => {
          expect(app.appType).toEqual('PRODUCT')
        })
        done()
      },
      error: done.fail
    })
  })

  it('should search products with empty appIds', (done) => {
    const app3: Application = { name: 'appName3', productName: 'product3' }
    const app4: Application = { name: 'appName4', productName: 'product4' }
    const appPageRes2: ApplicationPageResult = { stream: [app3, app4] }

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
   * UI Events
   */
  it('should navigate to detail page when a tile is clicked', () => {
    const app: App = {
      appId: 'appId',
      appType: 'APP'
    }
    const product: App = {
      appId: 'appId',
      appType: 'PRODUCT'
    }

    component.onAppClick(app)
    expect(mockRouter.navigate).toHaveBeenCalledWith(['./', 'app', app.appId], { relativeTo: undefined })

    component.onAppClick(product)
    expect(mockRouter.navigate).toHaveBeenCalledWith(['./', 'app', app.appId], { relativeTo: undefined })
  })

  describe('onQuickFilterChange', () => {
    it('should set typeFilterValue$ to an empty string when value is "ALL"', () => {
      const event = { value: 'ALL' }
      spyOn(component.typeFilterValue$, 'next')

      component.onQuickFilterChange(event)

      expect(component.typeFilterValue$.next).toHaveBeenCalledWith('')
    })

    it('should set typeFilterValue$ to given value when value is not "ALL" and is truthy', () => {
      const event = { value: 'SOME_VALUE' }
      spyOn(component.typeFilterValue$, 'next')

      component.onQuickFilterChange(event)

      expect(component.typeFilterValue$.next).toHaveBeenCalledWith('SOME_VALUE')
    })

    it('should not call typeFilterValue$.next when value is falsy', () => {
      const event = { value: '' }
      spyOn(component.typeFilterValue$, 'next')

      component.onQuickFilterChange(event)

      expect(component.typeFilterValue$.next).not.toHaveBeenCalled()
    })
  })

  it('should disable name input field if app type on search is ALL', () => {
    component.onAppTypeFilterChange({ value: 'ALL' })
    expect(component.appSearchCriteriaGroup.controls['name'].disabled).toBeTrue()

    component.onAppTypeFilterChange({ value: 'Apps' })
    expect(component.appSearchCriteriaGroup.controls['name'].enabled).toBeTrue()
  })

  it('should update textFilterValue$ when onFilterChange is called', () => {
    const filterValue = 'newFilter'
    spyOn(component.textFilterValue$, 'next')

    component.onFilterChange(filterValue)

    expect(component.textFilterValue$.next).toHaveBeenCalledWith(filterValue)
  })

  it('should set correct values onSortChange', () => {
    component.onSortChange('field')

    expect(component.sortField).toEqual('field')
  })

  describe('onSortDirChange', () => {
    it('should set correct values onSortDirChange', () => {
      component.onSortDirChange(true)

      expect(component.sortOrder).toEqual(-1)
    })

    it('should set correct values onSortDirChange', () => {
      component.onSortDirChange(false)

      expect(component.sortOrder).toEqual(1)
    })
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
          expect(res).toEqual([] as (App & RowListGridData)[])
        }
        done()
      },
      error: done.fail
    })
  })

  it('should open import dialog', () => {
    spyOn(component, 'onImport')

    component.ngOnInit()
    component.actions$?.subscribe((action) => {
      action[1].actionCallback()
    })

    expect(component.onImport).toHaveBeenCalled()
  })

  it('should open export dialog', () => {
    spyOn(component, 'onExport')

    component.ngOnInit()
    component.actions$?.subscribe((action) => {
      action[0].actionCallback()
    })

    expect(component.onExport).toHaveBeenCalled()
  })

  /*
   * IMPORT
   */
  it('should display import dialog when import button is clicked', () => {
    component.displayImportDialog = false

    component.onImport()

    expect(component.displayImportDialog).toBeTrue()
  })

  describe('onSelect', () => {
    let file: File
    let event: any = {}

    beforeEach(() => {
      translateServiceSpy.get.and.returnValue(of({}))
      file = new File(['file content'], 'test.txt', { type: 'text/plain' })
      const fileList: FileList = {
        0: file,
        length: 1,
        item: (index: number) => file
      }
      event = { files: fileList }
    })

    it('should select a file to upload', async () => {
      const mockText = '{ "appId": "id", "name": "onecx-permission-ui", "productName": "onecx-permission" }'
      spyOn(file, 'text').and.returnValue(Promise.resolve(mockText))
      translateServiceSpy.get.and.returnValue(of({}))

      await component.onSelect(event as any as FileSelectEvent)

      expect(file.text).toHaveBeenCalled()
      expect(component.importAssignmentItem).toEqual(JSON.parse(mockText))
    })

    it('should handle JSON parse error', async () => {
      spyOn(file, 'text').and.returnValue(Promise.resolve('Invalid Json'))
      spyOn(console, 'error')
      translateServiceSpy.get.and.returnValue(of({}))

      await component.onSelect(event)

      expect(console.error).toHaveBeenCalled()
      expect(component.importError).toBeTrue()
      expect(component.validationErrorCause).toBe('')
    })
  })

  it('should reset errors when clear button is clicked', () => {
    component.importError = true
    component.validationErrorCause = 'Some error'

    component.onClear()

    expect(component.importError).toBeFalse()
    expect(component.validationErrorCause).toBe('')
  })

  describe('onImportConfirmation', () => {
    it('should import assignment items', (done) => {
      assgnmtApiSpy.importAssignments.and.returnValue(of(permission))
      component.importAssignmentItem = permission

      component.onImportConfirmation()

      setTimeout(() => {
        expect(component.displayImportDialog).toBeFalse()
        expect(msgServiceSpy.success).toHaveBeenCalledWith({
          summaryKey: 'ACTIONS.IMPORT.MESSAGE.ASSIGNMENT.IMPORT_OK'
        })
        done()
      })
    })

    it('should call importAssignments and handle error', (done) => {
      assgnmtApiSpy.importAssignments.and.returnValue(throwError(() => 'Error'))
      component.importAssignmentItem = permission

      component.onImportConfirmation()

      setTimeout(() => {
        expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.ASSIGNMENT.IMPORT_NOK' })
        done()
      }, 0)
    })

    it('should not call importAssignments if importAssignmentItem is not defined', () => {
      component.importAssignmentItem = null

      component.onImportConfirmation()

      expect(assgnmtApiSpy.importAssignments).not.toHaveBeenCalled()
    })
  })

  it('should validate a file', () => {
    component.importError = false

    expect(component.isFileValid()).toBeTrue()
  })

  it('should close displayImportDialog', () => {
    component.displayImportDialog = true

    component.onCloseImportDialog()

    expect(component.displayImportDialog).toBeFalse()
  })

  /*
   * EXPORT
   */
  it('should prepare export by getting all products for export', (done) => {
    const app3: Application = { name: 'appName3', productName: 'product3' }
    const app4: Application = { name: 'appName4', productName: 'product4' }
    const appPageRes2: ApplicationPageResult = { stream: [app3, app4] }
    appApiSpy.searchApplications.and.returnValue(of(appPageRes2 as any))

    component.ngOnInit()
    component.onExport()

    component.products$.subscribe({
      next: (products) => {
        expect(products.length).toBe(2)
        expect(products[0].displayName).toEqual('product3')
        expect(products[1].displayName).toEqual('product4')
        done()
      },
      error: done.fail
    })
  })

  it('should handle error when getting all products for export', (done) => {
    const err = { status: 404 }
    appApiSpy.searchApplications.and.returnValue(throwError(() => err))

    component.ngOnInit()
    component.onExport()

    component.products$.subscribe({
      next: (products) => {
        expect(products.length).toBe(0)
        expect(component.exceptionKey).toEqual('EXCEPTIONS.HTTP_STATUS_404.APPS')
        done()
      },
      error: done.fail
    })
  })

  it('should display export dialog', () => {
    component.displayExportDialog = false

    component.onExport()

    expect(component.displayExportDialog).toBeTrue()
  })

  describe('Test translations', () => {
    it('should translate quick filter items', () => {
      component.prepareQuickFilterItems()

      let items: any = []
      component.quickFilterItems$!.subscribe((data) => (items = data))

      items[0].value

      expect(items[0].value).toEqual('ALL')
    })

    it('should translate app type items', () => {
      component.prepareAppTypeItems()

      let items: any = []
      component.appTypeItems$!.subscribe((data) => (items = data))

      items[0].value

      expect(items[0].value).toEqual('ALL')
    })
  })
})
