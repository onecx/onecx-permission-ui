import { NO_ERRORS_SCHEMA } from '@angular/core'
import { Location } from '@angular/common'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { ActivatedRouteSnapshot, ActivatedRoute, ParamMap, Router, provideRouter } from '@angular/router'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { DataViewModule } from 'primeng/dataview'
import { of, throwError } from 'rxjs'

import {
  Application,
  ApplicationPageResult,
  ApplicationAPIService,
  AssignmentAPIService,
  Permission,
  PermissionAPIService,
  PermissionPageResult,
  ProductDetails,
  RoleAPIService,
  WorkspaceAPIService,
  WorkspaceDetails,
  Role,
  RolePageResult,
  AssignmentPageResult,
  Assignment
} from 'src/app/shared/generated'
import { App, AppDetailComponent, PermissionViewRow } from './app-detail.component'
import { PortalMessageService, UserService } from '@onecx/portal-integration-angular'
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http'
import { Table } from 'primeng/table'
import { FilterMatchMode } from 'primeng/api'

const app: Application = {
  name: 'appName',
  appId: 'appId',
  productName: 'product'
}

const app2: Application = {
  name: 'appName2',
  appId: 'appId2',
  productName: 'product2'
}

const appPageRes: ApplicationPageResult = {
  stream: [app, app2]
}

const prodDetails: ProductDetails = {
  productName: 'prodName',
  displayName: 'displayName',
  mfe: [
    {
      appId: 'prodDetailMfeAppId',
      appName: 'prodDetailMfeAppName'
    }
  ],
  ms: [
    {
      appId: 'prodDetailMsAppId',
      appName: 'prodDetailMsAppName'
    }
  ]
}
const prodDetails2: ProductDetails = {
  productName: 'prodName2',
  displayName: 'displayName2',
  mfe: [
    {
      appId: 'prodDetailMfeAppId',
      appName: 'prodDetailMfeAppName'
    }
  ],
  ms: [
    {
      appId: 'prodDetailMsAppId',
      appName: 'prodDetailMsAppName'
    }
  ]
}
const wsDetails: WorkspaceDetails = {
  workspaceRoles: ['role1', 'role2'],
  products: [prodDetails, prodDetails2]
}

const role1: Role = {
  id: 'roleId1',
  name: 'roleName1'
}
const role2: Role = {
  id: 'roleId1',
  name: 'roleName1'
}
const rolePageRes: RolePageResult = {
  stream: [role1, role2]
}

const perm1: Permission = {
  id: 'permId1',
  appId: 'appId1',
  productName: 'prodName1'
}
const perm2: Permission = {
  id: 'permId1',
  appId: 'appId1',
  productName: 'prodName1'
}
const permPageRes: PermissionPageResult = {
  stream: [perm1, perm2]
}

const permRow: PermissionViewRow = {
  ...perm1,
  key: 'key',
  roles: { undefined },
  appType: 'MFE',
  appDisplayName: 'appName',
  productDisplayName: 'prodName',
  operator: false
}
const permRow2: PermissionViewRow = {
  ...perm2,
  key: 'key',
  roles: { undefined },
  appType: 'MFE',
  appDisplayName: 'appName',
  productDisplayName: 'prodName'
}

const assgmt1: Assignment = {
  appId: 'appId1',
  mandatory: true,
  permissionId: 'permId1'
}
const assgmt2: Assignment = {
  appId: 'appId2'
}
const assgmtPageRes: AssignmentPageResult = {
  stream: [assgmt1, assgmt2]
}

describe('AppDetailComponent', () => {
  let component: AppDetailComponent
  let fixture: ComponentFixture<AppDetailComponent>
  const mockActivatedRoute: ActivatedRoute = {
    snapshot: {
      paramMap: {
        get: (key: string) => 'product'
      } as ParamMap
    } as ActivatedRouteSnapshot
  } as ActivatedRoute
  const mockRouter = { navigate: jasmine.createSpy('navigate') }

  const appApiSpy = jasmine.createSpyObj<ApplicationAPIService>('ApplicationAPIService', ['searchApplications'])
  const assApiSpy = jasmine.createSpyObj<AssignmentAPIService>('AssignmentAPIService', [
    'searchAssignments',
    'createAssignment',
    'deleteAssignment',
    'grantRoleAssignments',
    'grantRoleApplicationAssignments',
    'grantRoleProductsAssignments',
    'revokeRoleApplicationAssignments',
    'revokeRoleProductsAssignments',
    'revokeRoleAssignments'
  ])
  const msgServiceSpy = jasmine.createSpyObj<PortalMessageService>('PortalMessageService', ['success', 'error'])
  const permApiSpy = jasmine.createSpyObj<PermissionAPIService>('PermissionAPIService', ['searchPermissions'])
  const roleApiSpy = jasmine.createSpyObj<RoleAPIService>('RoleAPIService', ['searchRoles', 'createRole'])
  const wsApiSpy = jasmine.createSpyObj<WorkspaceAPIService>('WorkspaceAPIService', ['getDetailsByWorkspaceName'])

  const mockUserService = {
    lang$: {
      getValue: jasmine.createSpy('getValue').and.returnValue('en')
    },
    hasPermission: jasmine.createSpy('hasPermission').and.callFake((permissionName) => {
      if (
        permissionName === 'ROLE#CREATE' ||
        permissionName === 'ROLE#EDIT' ||
        permissionName === 'ROLE#DELETE' ||
        permissionName === 'PERMISSION#CREATE' ||
        permissionName === 'PERMISSION#EDIT' ||
        permissionName === 'PERMISSION#DELETE' ||
        permissionName === 'PERMISSION#GRANT'
      ) {
        return true
      } else {
        return false
      }
    })
  }

  const locationSpy = jasmine.createSpyObj<Location>('Location', ['back'])

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [AppDetailComponent],
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
        provideRouter([{ path: '', component: AppDetailComponent }]),
        { provide: ApplicationAPIService, useValue: appApiSpy },
        { provide: AssignmentAPIService, useValue: assApiSpy },
        { provide: PortalMessageService, useValue: msgServiceSpy },
        { provide: PermissionAPIService, useValue: permApiSpy },
        { provide: RoleAPIService, useValue: roleApiSpy },
        { provide: WorkspaceAPIService, useValue: wsApiSpy },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: UserService, useValue: mockUserService },
        { provide: Location, useValue: locationSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents()
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(AppDetailComponent)
    component = fixture.componentInstance
    appApiSpy.searchApplications.and.returnValue(of(appPageRes) as any)
    assApiSpy.createAssignment.and.returnValue(of(assgmt1) as any)
    assApiSpy.deleteAssignment.and.returnValue(of({}) as any)
    assApiSpy.grantRoleAssignments.and.returnValue(of({}) as any)
    assApiSpy.grantRoleApplicationAssignments.and.returnValue(of({}) as any)
    assApiSpy.grantRoleProductsAssignments.and.returnValue(of({}) as any)
    assApiSpy.revokeRoleApplicationAssignments.and.returnValue(of({}) as any)
    assApiSpy.revokeRoleAssignments.and.returnValue(of({}) as any)
    assApiSpy.revokeRoleProductsAssignments.and.returnValue(of({}) as any)
    assApiSpy.searchAssignments.and.returnValue(of(assgmtPageRes) as any)
    permApiSpy.searchPermissions.and.returnValue(of(permPageRes) as any)
    roleApiSpy.searchRoles.and.returnValue(of(rolePageRes) as any)
    roleApiSpy.createRole.and.returnValue(of([role1]) as any)
    wsApiSpy.getDetailsByWorkspaceName.and.returnValue(of(wsDetails) as any)
    fixture.detectChanges()
  })

  afterEach(() => {
    msgServiceSpy.success.calls.reset()
    msgServiceSpy.error.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should prepare action buttons on init', () => {
    spyOn(component, 'onCreateRole')
    spyOn(component, 'onExport')

    component.ngOnInit()

    let actions: any = []
    component.actions$!.subscribe((act) => (actions = act))

    actions[0].actionCallback()
    actions[1].actionCallback()
    actions[2].actionCallback()

    expect(locationSpy.back).toHaveBeenCalled()
    expect(component.onCreateRole).toHaveBeenCalled()
    expect(component.onExport).toHaveBeenCalled()
  })

  it('should loadData onReload', () => {
    spyOn(component as any, 'loadData')

    component.onReload()

    expect((component as any).loadData).toHaveBeenCalled()
  })

  describe('onExport', () => {
    it('should set up export for WORKSPACE app type', () => {
      component.currentApp = {
        appType: 'WORKSPACE',
        workspaceDetails: {
          products: [{ productName: 'Product A' }, { productName: 'Product B' }]
        },
        isProduct: false
      }

      component.onExport()

      expect(component.productNames).toEqual(['Product A', 'Product B'])
      expect(component.listedProductsHeader).toBe('ACTIONS.EXPORT.WS_APPLICATION_LIST')
      expect(component.displayExportDialog).toBe(true)
    })

    it('should set up export for PRODUCT app type', () => {
      component.currentApp = {
        appType: 'PRODUCT',
        name: 'Test Product',
        isProduct: true
      }

      component.onExport()

      expect(component.productNames).toEqual(['Test Product'])
      expect(component.listedProductsHeader).toBe('ACTIONS.EXPORT.OF_APPLICATION')
      expect(component.displayExportDialog).toBe(true)
    })
  })

  /**
   * loadData
   */
  describe('loadData', () => {
    it('should not loadData if the url does not provide app id or app type', () => {
      component.urlParamAppId = null
      component.urlParamAppType = undefined

      const res = (component as any).loadData()

      expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_MISSING_PARAMETER')
      expect(res).toBeUndefined()
    })

    it('should loadProductDetails successfully', () => {
      const loadedApp: App = { ...app, appType: 'PRODUCT', isProduct: true }
      loadedApp.name = loadedApp.productName
      component.myPermissions = ['ROLE#CREATE']

      component.ngOnInit()

      expect(component.currentApp).toEqual(loadedApp)
      expect(component.myPermissions.length).toEqual(2)
      expect(component.myPermissions).toEqual(['ROLE#CREATE', 'ROLE#MANAGE'])
    })

    it('should detect manage roles/permissions on creation', () => {
      component.myPermissions = ['ROLE#CREATE', 'PERMISSION#CREATE']

      component.ngOnInit()

      expect(component.myPermissions.length).toEqual(4)
      expect(component.myPermissions).toEqual(['ROLE#CREATE', 'PERMISSION#CREATE', 'ROLE#MANAGE', 'PERMISSION#MANAGE'])
    })

    it('should detect manage roles/permissions on deletion', () => {
      component.myPermissions = ['ROLE#DELETE', 'PERMISSION#DELETE']

      component.ngOnInit()

      expect(component.myPermissions.length).toEqual(4)
      expect(component.myPermissions[2]).toEqual('ROLE#MANAGE')
      expect(component.myPermissions[3]).toEqual('PERMISSION#MANAGE')
    })

    it('should catch error if search for applications fails ', () => {
      appApiSpy.searchApplications.and.returnValue(of({ totalElements: 0, stream: [] } as any))
      component.urlParamAppId = 'unknown product'
      component.urlParamAppType = 'PRODUCT'

      component.ngOnInit()

      expect(component.loadingExceptionKey).toBe('EXCEPTIONS.NOT_FOUND.PRODUCT')
    })

    it('should catch error if search for applications fails ', () => {
      const err = new HttpErrorResponse({
        error: 'test 404 error',
        status: 404,
        statusText: 'Not Found'
      })
      appApiSpy.searchApplications.and.returnValue(throwError(() => err))

      component.ngOnInit()

      expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + err.status + '.APP')
    })

    it('should catch non-HttpErrorResponse error if search for applications fails', () => {
      const nonHttpError = { message: 'non-HTTP error' }
      appApiSpy.searchApplications.and.returnValue(throwError(() => nonHttpError))

      component.ngOnInit()

      expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_0.APP')
    })

    it('should loadWorkspaceDetails successfully', () => {
      component.urlParamAppType = 'WORKSPACE'

      component.ngOnInit()

      expect(component.currentApp.workspaceDetails).toEqual(wsDetails)
    })

    it('should catch error if workspace detail load fails ', () => {
      component.urlParamAppType = 'WORKSPACE'
      const err = new HttpErrorResponse({
        error: 'test 404 error',
        status: 404,
        statusText: 'Not Found'
      })
      wsApiSpy.getDetailsByWorkspaceName.and.returnValue(throwError(() => err))
      spyOn(console, 'error')

      component.ngOnInit()

      expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + err.status + '.WORKSPACE')
      expect(console.error).toHaveBeenCalledWith('getDetailsByWorkspaceName() => unknown response:', err)
    })

    xit('should catch non-HttpErrorResponse error if workspace detail load fails', () => {
      component.urlParamAppType = 'WORKSPACE'
      const nonHttpError = { message: 'non-HTTP error' }
      wsApiSpy.getDetailsByWorkspaceName.and.returnValue(throwError(() => nonHttpError))

      component.ngOnInit()

      expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_0.WORKSPACE')
    })

    it('should load roles and permissions', () => {
      component.urlParamAppType = 'WORKSPACE'

      component.ngOnInit()

      expect(component.roles.length).toBe(2)
      expect(component.permissions.length).toBe(2)
    })

    it('should display error when loading roles fails', () => {
      const err = { status: '404' }
      roleApiSpy.searchRoles.and.returnValue(throwError(() => err))
      component.urlParamAppType = 'WORKSPACE'

      component.ngOnInit()

      expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + err.status + '.ROLES')
    })

    it('should display error when loading permissions fails', () => {
      const err = { status: '404' }
      permApiSpy.searchPermissions.and.returnValue(throwError(() => err))
      component.urlParamAppType = 'WORKSPACE'

      component.ngOnInit()

      expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS')
    })
  })

  /**
   * CREATE
   */
  it('should do something onAddIAMRoles', () => {
    component.onAddIAMRoles(new MouseEvent('click'))

    expect(component.showIamRolesDialog).toBeTrue()
  })

  it('should return if there are no missing ws roles', () => {
    const ev = new MouseEvent('click')
    spyOn(ev, 'stopPropagation')
    component.missingWorkspaceRoles = false

    component.onCreateWorkspaceRoles(ev)

    expect(ev.stopPropagation).toHaveBeenCalled()
  })

  it('should create a role', () => {
    const ev = new MouseEvent('click')
    spyOn(ev, 'stopPropagation')
    component.missingWorkspaceRoles = true
    component.currentApp.workspaceDetails = wsDetails

    component.onCreateWorkspaceRoles(ev)

    expect(ev.stopPropagation).toHaveBeenCalled()
    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.ROLE.MESSAGE.WORKSPACE_ROLES_OK' })
  })

  it('should display error msg if create role fails', () => {
    roleApiSpy.createRole.and.returnValue(throwError(() => new Error()))
    const ev = new MouseEvent('click')
    spyOn(ev, 'stopPropagation')
    component.missingWorkspaceRoles = true
    component.currentApp.workspaceDetails = wsDetails

    component.onCreateWorkspaceRoles(ev)

    expect(ev.stopPropagation).toHaveBeenCalled()
    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.ROLE.MESSAGE.WORKSPACE_ROLES_NOK' })
  })

  /**
   * COLUMNS => Roles, ROWS => Permissions
   */
  it('should handle loading role assignments without apps', () => {
    component.urlParamAppType = 'WORKSPACE'
    spyOn(console, 'warn')
    component['productApps'] = []

    component['loadRoleAssignments'](true)

    expect(console.warn).toHaveBeenCalledWith('No apps found - stop loading assignments')
  })

  it('should search assigments', () => {
    component['searchAssignments'](true, ['appId'])

    expect(component.protectedAssignments.length).toBe(1)
  })

  it('should display error if search assigments fails', () => {
    const err = new HttpErrorResponse({
      error: 'test 404 error',
      status: 404,
      statusText: 'Not Found'
    })
    assApiSpy.searchAssignments.and.returnValue(throwError(() => err))

    component['searchAssignments'](true, ['appId'])

    expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + err.status + '.ASSIGNMENTS')
  })

  it('should catch non-HttpErrorResponse error if search for assignments fails', () => {
    const nonHttpError = { message: 'non-HTTP error' }
    assApiSpy.searchAssignments.and.returnValue(throwError(() => nonHttpError))

    component.ngOnInit()

    expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_0.ASSIGNMENTS')
  })

  /*
   * Table Filter
   */
  it('should set filterMode to CONTAINS when mode is "="', () => {
    component.onFilterModeChange('=')

    expect(component.filterMode).toBe(FilterMatchMode.CONTAINS)
  })

  it('should set filterMode to NOT_CONTAINS when mode is "!="', () => {
    component.onFilterModeChange('!=')

    expect(component.filterMode).toBe(FilterMatchMode.NOT_CONTAINS)
  })

  it('should not change filterMode when mode is undefined', () => {
    component.filterMode = FilterMatchMode.CONTAINS

    component.onFilterModeChange(undefined)

    expect(component.filterMode).toBe(FilterMatchMode.CONTAINS)
  })

  it('should call tableFilter with the input value', () => {
    spyOn(component, 'tableFilter')
    component.permissionTableFilterInput = { nativeElement: { value: 'test' } }
    component.permissionTable = { filterGlobal: jasmine.createSpy() } as unknown as Table

    component.onFilterModeChange('=')

    expect(component.filterValue).toBe('test')
    expect(component.tableFilter).toHaveBeenCalledWith('test')
  })

  it('should not call tableFilter when permissionTableFilterInput is not present', () => {
    spyOn(component, 'tableFilter')
    component.permissionTable = { filterGlobal: jasmine.createSpy() } as unknown as Table

    component.onFilterModeChange('=')

    expect(component.tableFilter).not.toHaveBeenCalled()
  })

  it('should set filterBy correctly and filterValue to an empty string when "ALL" is selected', () => {
    component.onQuickFilterChange({ value: 'ALL' })

    expect(component.filterBy).toEqual(['action', 'resource'])
    expect(component.filterValue).toBe('')
  })

  it('should set filterBy correctly and filterValue to quick filter value ', () => {
    component.onQuickFilterChange({ value: 'VIEW' })

    expect(component.filterBy).toEqual(['action'])
    expect(component.filterValue).toBe('VIEW')
  })

  it('should set the permissionTableFilterInput value and call tableFilter', () => {
    spyOn(component, 'tableFilter')
    component.permissionTableFilterInput = { nativeElement: { value: '' } }
    component.permissionTable = { filterGlobal: jasmine.createSpy() } as unknown as Table

    component.onQuickFilterChange({ value: 'ALL' })

    expect(component.permissionTableFilterInput.nativeElement.value).toBe('')
    expect(component.tableFilter).toHaveBeenCalledWith('')
  })

  it('should call filterGlobal on permissionTable with the provided value and filterMode', () => {
    component.permissionTable = { filterGlobal: jasmine.createSpy() } as unknown as Table
    component.filterMode = 'mode'

    component.tableFilter('testValue')

    expect(component.permissionTable.filterGlobal).toHaveBeenCalledWith('testValue', 'mode')
  })

  it('should clear all clear all values onClearTableFilter', () => {
    component.permissionTableFilterInput = { nativeElement: { value: 'value' } }
    component.quickFilterValue = 'ALL'
    component.filterAppValue = 'value'
    component.permissionTable = { clear: jasmine.createSpy() } as unknown as Table
    spyOn(component, 'onSortPermissionTable')

    component.onClearTableFilter()

    expect(component.permissionTableFilterInput.nativeElement.value).toBe('')
    expect(component.quickFilterValue).toBe('ALL')
    expect(component.filterAppValue).toBeUndefined()
    expect(component.onSortPermissionTable).toHaveBeenCalled()
    expect(component.permissionTable.clear).toHaveBeenCalled()
  })

  it('should reset icons onSortPermissionTables', () => {
    component.sortIconAppId = { nativeElement: { className: 'oldClassName' } }
    component.sortIconProduct = { nativeElement: { className: 'oldClassName' } }

    component.onSortPermissionTable()

    expect(component.sortIconAppId.nativeElement.className).toBe('pi pi-fw pi-sort-alt')
    expect(component.sortIconProduct.nativeElement.className).toBe('pi pi-fw pi-sort-alt')
  })

  /**
   * Filter: Product, AppId
   */
  it('should set icon class and sort by descending when icon class is "sort-alt"', () => {
    const event = new MouseEvent('click')
    const icon = document.createElement('span')
    icon.className = 'pi pi-fw pi-sort-alt'

    spyOn(event, 'stopPropagation')
    component.permissionTable = {
      clear: jasmine.createSpy(),
      _value: [permRow, permRow2],
      filterGlobal: jasmine.createSpy()
    } as unknown as Table

    component.onFilterItemSortIcon(event, icon, 'appId')

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permissionTable.clear).toHaveBeenCalled()
    expect(icon.className).toBe('pi pi-fw pi-sort-amount-down')
  })

  it('should set icon class sort by ascending when icon class is "sort-amount-down"', () => {
    const event = new MouseEvent('click')
    const icon = document.createElement('span')
    icon.className = 'pi pi-fw pi-sort-amount-down'

    spyOn(event, 'stopPropagation')
    component.permissionTable = {
      clear: jasmine.createSpy(),
      _value: [permRow, permRow2],
      filterGlobal: jasmine.createSpy()
    } as unknown as Table

    component.onFilterItemSortIcon(event, icon, 'appId')

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permissionTable.clear).toHaveBeenCalled()
    expect(icon.className).toBe('pi pi-fw pi-sort-amount-up-alt')
  })

  it('should set icon class and sort by descending when icon class is "sort-amount-up-alt"', () => {
    const event = new MouseEvent('click')
    const icon = document.createElement('span')
    icon.className = 'pi pi-fw pi-sort-amount-up-alt'

    spyOn(event, 'stopPropagation')
    component.permissionTable = {
      clear: jasmine.createSpy(),
      _value: [permRow, permRow2],
      filterGlobal: jasmine.createSpy()
    } as unknown as Table

    component.onFilterItemSortIcon(event, icon, 'appId')

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permissionTable.clear).toHaveBeenCalled()
    expect(icon.className).toBe('pi pi-fw pi-sort-amount-down')
  })

  /* same tests for sortByProduct */
  it('should set icon class and sort by descending when icon class is "sort-alt"', () => {
    const event = new MouseEvent('click')
    const icon = document.createElement('span')
    icon.className = 'pi pi-fw pi-sort-alt'

    spyOn(event, 'stopPropagation')
    component.permissionTable = {
      clear: jasmine.createSpy(),
      _value: [permRow, permRow2],
      filterGlobal: jasmine.createSpy()
    } as unknown as Table

    component.onFilterItemSortIcon(event, icon, 'product')

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permissionTable.clear).toHaveBeenCalled()
    expect(icon.className).toBe('pi pi-fw pi-sort-amount-down')
  })

  it('should set icon class sort by ascending when icon class is "sort-amount-down"', () => {
    const event = new MouseEvent('click')
    const icon = document.createElement('span')
    icon.className = 'pi pi-fw pi-sort-amount-down'

    spyOn(event, 'stopPropagation')
    component.permissionTable = {
      clear: jasmine.createSpy(),
      _value: [permRow, permRow2],
      filterGlobal: jasmine.createSpy()
    } as unknown as Table

    component.onFilterItemSortIcon(event, icon, 'product')

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permissionTable.clear).toHaveBeenCalled()
    expect(icon.className).toBe('pi pi-fw pi-sort-amount-up-alt')
  })

  it('should set icon class and sort by descending when icon class is "sort-amount-up-alt"', () => {
    const event = new MouseEvent('click')
    const icon = document.createElement('span')
    icon.className = 'pi pi-fw pi-sort-amount-up-alt'

    spyOn(event, 'stopPropagation')
    component.permissionTable = {
      clear: jasmine.createSpy(),
      _value: [permRow, permRow2],
      filterGlobal: jasmine.createSpy()
    } as unknown as Table

    component.onFilterItemSortIcon(event, icon, 'product')

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permissionTable.clear).toHaveBeenCalled()
    expect(icon.className).toBe('pi pi-fw pi-sort-amount-down')
  })

  it('should clear filter', () => {
    component.permissionTable = { filter: jasmine.createSpy() } as unknown as Table

    component.onFilterItemClearAppId()

    expect(component.filterAppValue).toBeUndefined()
    expect(component.permissionTable.filter).toHaveBeenCalledWith(undefined, 'appId', 'notEquals')
  })

  it('should set filterProductValue and filterAppValue, call filter on permissionTable with "notEquals" and "equals", and call prepareFilterApps', () => {
    const event = { value: 'someProduct' }
    component.permissionTable = { filter: jasmine.createSpy() } as unknown as Table

    component.onFilterItemChangeProduct(event)

    expect(component.filterProductValue).toBe('someProduct')
    expect(component.filterAppValue).toBeUndefined()
    expect(component.permissionTable.filter).toHaveBeenCalledWith(undefined, 'appId', 'notEquals')
    expect(component.permissionTable.filter).toHaveBeenCalledWith('someProduct', 'productName', 'equals')
  })

  /*
   * ROLE
   */
  it('should call stopPropagation and set role to undefined in onCreateRole', () => {
    const event = new MouseEvent('click')
    spyOn(event, 'stopPropagation')

    component.onCreateRole(event)

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.role).toBeUndefined()
    expect(component.changeMode).toBe('CREATE')
    expect(component.showRoleDetailDialog).toBeTrue()
  })

  it('should call stopPropagation and set role in onEditRole', () => {
    const event = new MouseEvent('click')
    spyOn(event, 'stopPropagation')

    component.onEditRole(event, role1)

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.role).toBe(role1)
    expect(component.changeMode).toBe('EDIT')
    expect(component.showRoleDetailDialog).toBeTrue()
  })

  it('should call stopPropagation and set role in onDeleteRole', () => {
    const event = new MouseEvent('click')
    spyOn(event, 'stopPropagation')

    component.onDeleteRole(event, role1)

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.role).toBe(role1)
    expect(component.changeMode).toBe('DELETE')
    expect(component.showRoleDeleteDialog).toBeTrue()
  })

  it('should reset state and call loadData if changed in onDetailChanged', () => {
    component.onDetailChanged(true)

    expect(component.role).toBeUndefined()
    expect(component.permission).toBeUndefined()
    expect(component.changeMode).toBe('VIEW')
    expect(component.showPermissionDetailDialog).toBeFalse()
    expect(component.showPermissionDeleteDialog).toBeFalse()
    expect(component.showRoleDetailDialog).toBeFalse()
    expect(component.showRoleDeleteDialog).toBeFalse()
  })

  /*
   * PERMISSION
   */

  it('should call onDetailPermission in create mode onCopyPermission', () => {
    const event = new MouseEvent('click')
    spyOn(component, 'onDetailPermission')

    component.onCopyPermission(event, permRow)

    expect(component.onDetailPermission).toHaveBeenCalledWith(event, permRow)
    expect(component.changeMode).toBe('CREATE')
  })

  it('should call stopPropagation and set role to undefined in onCreatePermission', () => {
    const event = new MouseEvent('click')
    spyOn(event, 'stopPropagation')

    component.onCreatePermission(event)

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.role).toBeUndefined()
    expect(component.changeMode).toBe('CREATE')
    expect(component.showPermissionDetailDialog).toBeTrue()
  })

  it('should call stopPropagation and set permission onDetailPermission', () => {
    const event = new MouseEvent('click')
    spyOn(event, 'stopPropagation')

    component.onDetailPermission(event, permRow)

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permission).toBe(permRow)
    expect(component.changeMode).toBe('EDIT')
    expect(component.showPermissionDetailDialog).toBeTrue()
  })

  it('should set changeMode according to operator onDetailPermission', () => {
    const event = new MouseEvent('click')
    spyOn(event, 'stopPropagation')

    component.onDetailPermission(event, permRow)

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permission).toBe(permRow)
    expect(component.changeMode).toBe('EDIT')
    expect(component.showPermissionDetailDialog).toBeTrue()
  })

  it('should call stopPropagation and set permission in onDeletePermission', () => {
    const event = new MouseEvent('click')
    spyOn(event, 'stopPropagation')

    component.onDeletePermission(event, permRow)

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permission).toBe(permRow)
    expect(component.changeMode).toBe('DELETE')
    expect(component.showPermissionDeleteDialog).toBeTrue()
  })

  /****************************************************************************
   *  ASSIGNMENTS    => grant + revoke permissions => assign roles
   ****************************************************************************
   */
  it('should create an assignment', () => {
    const ev = new MouseEvent('click')

    component.onAssignPermission(ev, permRow, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_SUCCESS' })
  })

  it('should display error if assignment fails', () => {
    assApiSpy.createAssignment.and.returnValue(throwError(() => new Error()))
    const ev = new MouseEvent('click')

    component.onAssignPermission(ev, permRow, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
  })

  it('should delete an assignment', () => {
    const ev = new MouseEvent('click')

    component.onRemovePermission(ev, permRow, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_SUCCESS' })
  })

  it('should display error if assignment creation fails', () => {
    assApiSpy.deleteAssignment.and.returnValue(throwError(() => new Error()))
    const ev = new MouseEvent('click')

    component.onRemovePermission(ev, permRow, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
  })

  it('should grant all permissions: assign all perms of an app to a role', () => {
    const ev = new MouseEvent('click')
    component.filterAppValue = 'appId'

    component.ngOnInit()
    component.onGrantAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ALL_SUCCESS' })
  })

  it('should display error when trying to grant all permissions: assign all perms of an app to a role', () => {
    assApiSpy.grantRoleApplicationAssignments.and.returnValue(throwError(() => new Error()))
    const ev = new MouseEvent('click')
    component.filterAppValue = 'appId'

    component.ngOnInit()
    component.onGrantAllPermissions(ev, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
  })

  it('should grant all permissions: assign all perms of all apps of a product to a role', () => {
    const ev = new MouseEvent('click')
    component.filterProductValue = 'productAppId'

    component.ngOnInit()
    component.onGrantAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ALL_SUCCESS' })
  })

  it('should display error when trying to grant all permissions: assign all perms of all apps of a product to a role', () => {
    assApiSpy.grantRoleProductsAssignments.and.returnValue(throwError(() => new Error()))
    const ev = new MouseEvent('click')
    component.filterProductValue = 'productAppId'

    component.ngOnInit()
    component.onGrantAllPermissions(ev, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
  })

  it('should grant all permissions: assign all perms of all apps of a product to a role', () => {
    const ev = new MouseEvent('click')

    component.ngOnInit()
    component.onGrantAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ALL_SUCCESS' })
  })

  it('should revoke all permissions: remove all perms of an app to a role', () => {
    const ev = new MouseEvent('click')
    component.filterAppValue = 'appId'

    component.ngOnInit()
    component.onRevokeAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ALL_SUCCESS' })
  })

  it('should display error when trying to revoke all permissions: remove all perms of an app to a role', () => {
    assApiSpy.revokeRoleApplicationAssignments.and.returnValue(throwError(() => new Error()))
    const ev = new MouseEvent('click')
    component.filterAppValue = 'appId'

    component.ngOnInit()
    component.onRevokeAllPermissions(ev, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
  })

  it('should revoke all permissions: remove all assgnmts of all apps of a product to a role - case 1: for a product', () => {
    const ev = new MouseEvent('click')
    component.filterProductValue = 'productAppId'

    component.ngOnInit()
    component.onRevokeAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ALL_SUCCESS' })
  })

  it('should revoke all permissions: remove all assgnmts of all apps of a product to a role - case 2a) in a workspace for a selected product', () => {
    const ev = new MouseEvent('click')
    component.filterProductValue = 'productAppId'
    component.urlParamAppType = 'WORKSPACE'

    component.ngOnInit()
    component.onRevokeAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ALL_SUCCESS' })
  })

  it('should revoke all permissions: remove all assgnmts of all apps of a product to a role - case 2b) in a workspace for all products', () => {
    component.filterProductItems = [
      { label: 'prodName', value: 'prodName' },
      { label: 'prodName2', value: 'prodName2' }
    ]
    component.filterProductValue = undefined
    component.currentApp.isProduct = false

    const res = component['prepareProductListForBulkOperation']()

    expect(res).toEqual(['prodName', 'prodName2'])
  })

  it('should display error when trying to revoke all permissions: remove all assgmts of all apps of a product to a role', () => {
    assApiSpy.revokeRoleProductsAssignments.and.returnValue(throwError(() => new Error()))
    const ev = new MouseEvent('click')
    component.filterProductValue = 'productAppId'

    component.ngOnInit()
    component.onRevokeAllPermissions(ev, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
  })

  it('should revoke all permissions: remove all assgmts of a role', () => {
    const ev = new MouseEvent('click')

    component.ngOnInit()
    component.onRevokeAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ALL_SUCCESS' })
  })

  /*
   * EDGE CASES
   */
  it('should return 0 when sorting permissions without appIds or prod names', () => {
    const perm3: Permission = {
      id: 'permId3'
    }
    const permRow3: PermissionViewRow = {
      ...perm3,
      key: 'key',
      roles: { undefined },
      appType: 'MFE',
      appDisplayName: 'appName',
      productDisplayName: 'prodName'
    }
    const permRow4: PermissionViewRow = {
      ...perm3,
      key: 'key',
      roles: { undefined },
      appType: 'MFE',
      appDisplayName: 'appName',
      productDisplayName: 'prodName'
    }
    const resultAppAsc = (component as any).sortPermissionRowByAppIdAsc(permRow3, permRow4)
    expect(resultAppAsc).toBe(0)

    const resultAppDesc = (component as any).sortPermissionRowByAppIdDesc(permRow3, permRow4)
    expect(resultAppDesc).toBe(0)

    const resultProdAsc = (component as any).sortPermissionRowByProductAsc(permRow3, permRow4)
    expect(resultProdAsc).toBe(0)

    const resultProdDesc = (component as any).sortPermissionRowByProductDesc(permRow3, permRow4)
    expect(resultProdDesc).toBe(0)
  })

  it('should return 0 when sorting permissions without appIds or prod names', () => {
    const role3: Role = {
      id: 'roleId1'
    }
    const role4: Role = {
      id: 'roleId1'
    }

    const result = (component as any).sortRoleByName(role3, role4)

    expect(result).toBe(0)
  })

  it('should call this.user.lang$ from the constructor and set this.dateFormat to the correct format if user.lang$ de', () => {
    mockUserService.lang$.getValue.and.returnValue('de')
    fixture = TestBed.createComponent(AppDetailComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
    expect(component.dateFormat).toEqual('dd.MM.yyyy HH:mm')
  })

  xit('should call this.user.lang$ from the constructor and set this.dateFormat to the correct format if user.lang$ de', () => {
    const perm = mockUserService.hasPermission.and.returnValue(true)
    fixture = TestBed.createComponent(AppDetailComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
    expect(perm).toBeTrue()
  })

  describe('Test translations', () => {
    it('should translate quick filter items', () => {
      component.prepareQuickFilterItems()

      let items: any = []
      component.quickFilterItems$!.subscribe((data) => (items = data))

      items[0].value

      expect(items[0].value).toEqual('ALL')
    })
  })
})
