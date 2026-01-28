import { NO_ERRORS_SCHEMA } from '@angular/core'
import { Location } from '@angular/common'
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { ActivatedRouteSnapshot, ActivatedRoute, ParamMap, Router, provideRouter } from '@angular/router'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, throwError } from 'rxjs'
import { DataViewModule } from 'primeng/dataview'
import { FilterMatchMode } from 'primeng/api'
import { Table } from 'primeng/table'

import { PortalMessageService, UserService } from '@onecx/angular-integration-interface'

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

// this application can be a workspace or product: set appType on your tests
const app1: Application = {
  name: 'appName1',
  appId: 'appId1',
  productName: 'prodName1'
}

const app2: Application = {
  name: 'appName2',
  appId: 'appId2',
  productName: 'prodName1'
}

const appPageRes: ApplicationPageResult = {
  stream: [app1, app2]
}

const prodDetails1: ProductDetails = {
  productName: 'prodName1',
  displayName: 'prodDisplayName1',
  mfe: [{ appId: 'prodDetailMfeAppId', appName: 'prodDetailMfeAppName' }],
  ms: [{ appId: 'prodDetailMsAppId', appName: 'prodDetailMsAppName' }]
}
const prodDetails2: ProductDetails = {
  productName: 'prodName2',
  displayName: 'prodDisplayName2',
  mfe: [{ appId: 'prodDetailMfeAppId', appName: 'prodDetailMfeAppName' }],
  ms: [{ appId: 'prodDetailMsAppId', appName: 'prodDetailMsAppName' }]
}

const wsDetails: WorkspaceDetails = {
  workspaceRoles: ['role1', 'role2'],
  products: [prodDetails1, prodDetails2]
}

const role1: Role = {
  id: 'roleId1',
  name: 'roleName1'
}
const role2: Role = {
  id: 'roleId2',
  name: 'roleName2'
}
const rolePageRes: RolePageResult = {
  stream: [role1, role2]
}

const perm1: Permission = {
  id: 'permId1',
  appId: 'appId1',
  productName: 'prodName1',
  mandatory: false
}
const perm2: Permission = {
  id: 'permId2',
  appId: 'appId2',
  productName: 'prodName2'
}
const permPageRes: PermissionPageResult = {
  stream: [perm1, perm2]
}

const permRow: PermissionViewRow = {
  ...perm1,
  key: 'key',
  roles: { undefined },
  appType: 'MFE',
  appDisplayName: 'appName1',
  productDisplayName: 'prodName1',
  operator: false
}
const permRow2: PermissionViewRow = {
  ...perm2,
  key: 'key',
  roles: { undefined },
  appType: 'MFE',
  appDisplayName: 'appName1',
  productDisplayName: 'prodName1'
}

const assgmt1: Assignment = {
  appId: 'appId1',
  mandatory: true,
  permissionId: 'permId1',
  roleId: 'roleId1'
}
const assgmt2: Assignment = {
  appId: 'appId2',
  permissionId: 'permId2',
  roleId: 'roleId1'
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
        get: (key: string) => 'prodName1'
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
    spyOn(component, 'onExport')

    component.ngOnInit()

    let actions: any = []
    component.actions$!.subscribe((act) => (actions = act))

    actions[0].actionCallback()
    actions[1].actionCallback()

    expect(locationSpy.back).toHaveBeenCalled()
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
      expect(component.listedProductsHeaderKey).toBe('ACTIONS.EXPORT.WS_APPLICATION_LIST')
      expect(component.displayPermissionExportDialog).toBe(true)
    })

    it('should set up export for PRODUCT app type', () => {
      component.currentApp = {
        appType: 'PRODUCT',
        name: 'Test Product',
        isProduct: true
      }

      component.onExport()

      expect(component.productNames).toEqual(['Test Product'])
      expect(component.listedProductsHeaderKey).toBe('ACTIONS.EXPORT.OF_APPLICATION')
      expect(component.displayPermissionExportDialog).toBe(true)
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

      expect(component.exceptionKey).toBe('EXCEPTIONS.HTTP_MISSING_PARAMETER')
      expect(res).toBeUndefined()
    })

    it('should loadProductDetails successfully', () => {
      const loadedApp: App = { ...app1, appType: 'PRODUCT', isProduct: true, apps: ['appId1', 'appId2'] }
      loadedApp.name = loadedApp.productName // is a product
      component.urlParamAppId = app1.name!
      component.urlParamAppType = loadedApp.appType
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

      expect(component.exceptionKey).toBe('EXCEPTIONS.NOT_FOUND.PRODUCT')
    })

    it('should catch error if search for applications fails ', () => {
      const errorResponse = new HttpErrorResponse({
        error: 'test 404 error',
        status: 404,
        statusText: 'Not Found'
      })
      appApiSpy.searchApplications.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')

      component.ngOnInit()

      expect(component.exceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + errorResponse.status + '.APP')
      expect(console.error).toHaveBeenCalledWith('searchApplications', errorResponse)
    })

    it('should catch non-HttpErrorResponse error if search for applications fails', () => {
      const errorResponse = { message: 'non-HTTP error' }
      appApiSpy.searchApplications.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')

      component.ngOnInit()

      expect(component.exceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_0.APP')
      expect(console.error).toHaveBeenCalledWith('searchApplications', errorResponse)
    })

    it('should loadWorkspaceDetails successfully', () => {
      component.urlParamAppType = 'WORKSPACE'

      component.ngOnInit()

      expect(component.currentApp.workspaceDetails).toEqual(wsDetails)
    })

    it('should catch error if workspace detail load fails ', () => {
      component.urlParamAppType = 'WORKSPACE'
      const errorResponse = new HttpErrorResponse({
        error: 'test 404 error',
        status: 404,
        statusText: 'Not Found'
      })
      wsApiSpy.getDetailsByWorkspaceName.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')

      component.ngOnInit()

      expect(component.exceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + errorResponse.status + '.WORKSPACE')
      expect(console.error).toHaveBeenCalledWith('getDetailsByWorkspaceName', errorResponse)
    })

    it('should load roles and permissions', () => {
      component.urlParamAppType = 'WORKSPACE'

      component.ngOnInit()

      expect(component.roles.length).toBe(2)
      expect(component.permissions.length).toBe(2)
    })

    it('should filter roles', () => {
      component.roles = [
        { name: 'role1', isWorkspaceRole: true },
        { name: 'role2', isWorkspaceRole: false }
      ]
      component.rolesFiltered = []

      component.onRoleFilterChange('role1')

      expect(component.roles.length).toBe(2)
      expect(component.rolesFiltered.length).toBe(1)

      component.rolesFiltered = []

      component.onRoleFilterChange('')

      expect(component.rolesFiltered.length).toBe(2)
    })

    it('should display error when loading roles fails', () => {
      const errorResponse = { status: '404', statusText: 'Not Found' }
      roleApiSpy.searchRoles.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      component.urlParamAppType = 'WORKSPACE'

      component.ngOnInit()

      expect(component.exceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + errorResponse.status + '.ROLES')
      expect(console.error).toHaveBeenCalledWith('searchRoles', errorResponse)
    })

    it('should go if no roles are loaded', () => {
      roleApiSpy.searchRoles.and.returnValue(of({}) as any)
      component.urlParamAppType = 'WORKSPACE'

      component.ngOnInit()
    })
    it('should go if no roles are loaded', () => {
      permApiSpy.searchPermissions.and.returnValue(of({}) as any)
      component.urlParamAppType = 'WORKSPACE'
      spyOn(console, 'warn')

      component.ngOnInit()

      expect(console.warn).toHaveBeenCalledWith('No permissions found for the apps - stop processing')
    })

    it('should display error when loading permissions fails', () => {
      const errorResponse = { status: '404', statusText: 'Not Found' }
      permApiSpy.searchPermissions.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      spyOn(console, 'warn')
      component.urlParamAppType = 'WORKSPACE'

      component.ngOnInit()

      expect(component.exceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + errorResponse.status + '.PERMISSIONS')
      expect(console.error).toHaveBeenCalledWith('searchPermissions', errorResponse)
      expect(console.warn).toHaveBeenCalledWith('No permissions found for the apps - stop processing')
    })
  })

  /**
   * CREATE
   */
  describe('create', () => {
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
      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.WORKSPACE_ROLES_OK' })
    })

    it('should display error msg if create role fails', () => {
      const errorResponse = { error: 'Error on creating a role', status: 400 }
      roleApiSpy.createRole.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      const ev = new MouseEvent('click')
      spyOn(ev, 'stopPropagation')
      component.missingWorkspaceRoles = true
      component.currentApp.workspaceDetails = wsDetails

      component.onCreateWorkspaceRoles(ev)

      expect(ev.stopPropagation).toHaveBeenCalled()
      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.ROLE.MESSAGE.WORKSPACE_ROLES_NOK' })
      expect(console.error).toHaveBeenCalledWith('createRole', errorResponse)
    })
  })

  /**
   * COLUMNS => Roles, ROWS => Permissions
   */
  it('should handle loading role assignments without apps', () => {
    component.urlParamAppType = 'WORKSPACE'
    spyOn(console, 'warn')
    component.productApps = []

    component['loadRoleAssignments'](true)

    expect(console.warn).toHaveBeenCalledWith('No apps found - stop loading assignments')
  })

  it('should search assigments', () => {
    component['searchAssignments'](true, ['appId1'])

    expect(component.protectedAssignments.length).toBe(1)
  })

  it('should display error if search assigments fails', () => {
    const errorResponse = new HttpErrorResponse({
      error: 'test 404 error',
      status: 404,
      statusText: 'Not Found'
    })
    assApiSpy.searchAssignments.and.returnValue(throwError(() => errorResponse))
    spyOn(console, 'error')

    component['searchAssignments'](true, ['appId1'])

    expect(component.exceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + errorResponse.status + '.ASSIGNMENTS')
    expect(console.error).toHaveBeenCalledWith('searchAssignments', errorResponse)
  })

  it('should catch non-HttpErrorResponse error if search for assignments fails', () => {
    const errorResponse = { message: 'non-HTTP error' }
    assApiSpy.searchAssignments.and.returnValue(throwError(() => errorResponse))
    spyOn(console, 'error')

    component.ngOnInit()

    expect(component.exceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_0.ASSIGNMENTS')
    expect(console.error).toHaveBeenCalledWith('searchAssignments', errorResponse)
  })

  /*
   * Table Filter
   */
  describe('table global filter', () => {
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

      expect(component.sortIconAppId.nativeElement.className).toBe('pi pi-sort-alt')
      expect(component.sortIconProduct.nativeElement.className).toBe('pi pi-sort-alt')
    })
  })

  /**
   * Filter: Product, AppId
   */
  describe('table column sorting', () => {
    it('should set icon class and sort by descending when icon class is "sort-alt"', () => {
      const event = new MouseEvent('click')
      const icon = document.createElement('span')
      icon.className = 'pi pi-sort-alt'

      spyOn(event, 'stopPropagation')
      component.permissionTable = {
        clear: jasmine.createSpy(),
        _value: [permRow, permRow2],
        filterGlobal: jasmine.createSpy()
      } as unknown as Table

      component.onFilterItemSortIcon(event, icon, 'appId')

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(component.permissionTable.clear).toHaveBeenCalled()
      expect(icon.className).toBe('pi pi-sort-amount-down')
    })

    it('should set icon class sort by ascending when icon class is "sort-amount-down"', () => {
      const event = new MouseEvent('click')
      const icon = document.createElement('span')
      icon.className = 'pi pi-sort-amount-down'

      spyOn(event, 'stopPropagation')
      component.permissionTable = {
        clear: jasmine.createSpy(),
        _value: [permRow, permRow2],
        filterGlobal: jasmine.createSpy()
      } as unknown as Table

      component.onFilterItemSortIcon(event, icon, 'appId')

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(component.permissionTable.clear).toHaveBeenCalled()
      expect(icon.className).toBe('pi pi-sort-amount-up-alt')
    })

    it('should set icon class and sort by descending when icon class is "sort-amount-up-alt"', () => {
      const event = new MouseEvent('click')
      const icon = document.createElement('span')
      icon.className = 'pi pi-sort-amount-up-alt'

      spyOn(event, 'stopPropagation')
      component.permissionTable = {
        clear: jasmine.createSpy(),
        _value: [permRow, permRow2],
        filterGlobal: jasmine.createSpy()
      } as unknown as Table

      component.onFilterItemSortIcon(event, icon, 'appId')

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(component.permissionTable.clear).toHaveBeenCalled()
      expect(icon.className).toBe('pi pi-sort-amount-down')
    })

    /* same tests for sortByProduct */
    it('should set icon class and sort by descending when icon class is "sort-alt"', () => {
      const event = new MouseEvent('click')
      const icon = document.createElement('span')
      icon.className = 'pi pi-sort-alt'

      spyOn(event, 'stopPropagation')
      component.permissionTable = {
        clear: jasmine.createSpy(),
        _value: [permRow, permRow2],
        filterGlobal: jasmine.createSpy()
      } as unknown as Table

      component.onFilterItemSortIcon(event, icon, 'prodName')

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(component.permissionTable.clear).toHaveBeenCalled()
      expect(icon.className).toBe('pi pi-sort-amount-down')
    })

    it('should set icon class sort by ascending when icon class is "sort-amount-down"', () => {
      const event = new MouseEvent('click')
      const icon = document.createElement('span')
      icon.className = 'pi pi-sort-amount-down'

      spyOn(event, 'stopPropagation')
      component.permissionTable = {
        clear: jasmine.createSpy(),
        _value: [permRow, permRow2],
        filterGlobal: jasmine.createSpy()
      } as unknown as Table

      component.onFilterItemSortIcon(event, icon, 'prodName')

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(component.permissionTable.clear).toHaveBeenCalled()
      expect(icon.className).toBe('pi pi-sort-amount-up-alt')
    })

    it('should set icon class and sort by descending when icon class is "sort-amount-up-alt"', () => {
      const event = new MouseEvent('click')
      const icon = document.createElement('span')
      icon.className = 'pi pi-sort-amount-up-alt'

      spyOn(event, 'stopPropagation')
      component.permissionTable = {
        clear: jasmine.createSpy(),
        _value: [permRow, permRow2],
        filterGlobal: jasmine.createSpy()
      } as unknown as Table

      component.onFilterItemSortIcon(event, icon, 'prodName')

      expect(event.stopPropagation).toHaveBeenCalled()
      expect(component.permissionTable.clear).toHaveBeenCalled()
      expect(icon.className).toBe('pi pi-sort-amount-down')
    })
  })

  describe('table column filtering', () => {
    it('should clear filter', () => {
      component.permissionTable = { filter: jasmine.createSpy() } as unknown as Table

      component.onFilterItemClearAppId()

      expect(component.filterAppValue).toBeUndefined()
      expect(component.permissionTable.filter).toHaveBeenCalledWith(undefined, 'appId', 'notEquals')
    })

    it('should set filterProductValue and filterAppValue, call filter on permissionTable with "notEquals" and "equals", and call prepareFilterApps', () => {
      const event = { value: 'prodName1' }

      component.ngOnInit()
      expect(component.roles.length).toBe(2)
      expect(component.permissions.length).toBe(2)
      expect(component.permissionRows.length).toBe(2)
      // component.permissionRows => permPageRes

      component.permissionTable = { filter: jasmine.createSpy(), value: component.permissionRows } as unknown as Table

      component.onFilterItemChangeProduct(event)

      expect(component.filterProductValue).toBe(event.value)
      expect(component.filterAppValue).toBeUndefined()
      expect(component.permissionTable.filter).toHaveBeenCalledWith(undefined, 'appId', 'notEquals')
      expect(component.permissionTable.filter).toHaveBeenCalledWith(event.value, 'productName', 'equals')
    })

    it('should reset filterProductValue and filterAppValue, call filter on permissionTable with "notEquals" and "equals", and call prepareFilterApps', () => {
      const event = { value: '' }
      component.permissionTable = { filter: jasmine.createSpy() } as unknown as Table

      component.ngOnInit()
      component.onFilterItemChangeProduct(event)

      expect(component.filterProductValue).toBe(event.value)
      expect(component.filterAppValue).toBeUndefined()
      expect(component.permissionTable.filter).toHaveBeenCalledWith(undefined, 'appId', 'notEquals')
      expect(component.permissionTable.filter).toHaveBeenCalledWith(event.value, 'productName', 'equals')
    })

    it('should filter apps from permissions for the selected product', () => {
      const loadedApp: App = { ...app1, appType: 'PRODUCT', isProduct: true, apps: ['appId1', 'appId2'] }
      loadedApp.name = loadedApp.productName // is a product
      component.urlParamAppId = app1.name!
      component.urlParamAppType = loadedApp.appType

      component.ngOnInit()
      expect(component.currentApp).toEqual(loadedApp)

      expect(component.roles.length).toBe(2)
      expect(component.permissions.length).toBe(2)
      expect(component.permissions).toEqual([
        { id: 'permId1', appId: 'appId1', productName: 'prodName1', mandatory: false },
        { id: 'permId2', appId: 'appId2', productName: 'prodName2' }
      ])
      // component.permissionRows => permPageRes
      expect(component.permissionRows.length).toBe(2)

      expect(component.productApps.length).toBe(2)
      expect(component.productApps).toEqual([
        { name: 'appName1', appId: 'appId1', productName: 'prodName1' } as App,
        { name: 'appName2', appId: 'appId2', productName: 'prodName1' } as App
      ])
      expect(loadedApp.productName).toEqual('prodName1')

      component.prepareFilterApps()
      expect(component.filterAppItems.length).toBe(2)
      expect(component.filterAppItems).toEqual([
        { label: 'appId2', value: 'appId2' },
        { label: 'appName1', value: 'appId1' }
      ])

      component.prepareFilterApps('prodName2')
      expect(component.filterAppItems.length).toBe(1)
    })
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
    expect(component.displayPermissionDetailDialog).toBeFalse()
    expect(component.displayPermissionDeleteDialog).toBeFalse()
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
    expect(component.displayPermissionDetailDialog).toBeTrue()
  })

  it('should call stopPropagation and set permission onDetailPermission', () => {
    const event = new MouseEvent('click')
    spyOn(event, 'stopPropagation')

    component.onDetailPermission(event, permRow)

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permission).toBe(permRow)
    expect(component.changeMode).toBe('EDIT')
    expect(component.displayPermissionDetailDialog).toBeTrue()
  })

  it('should set changeMode according to operator onDetailPermission', () => {
    const event = new MouseEvent('click')
    spyOn(event, 'stopPropagation')

    component.onDetailPermission(event, permRow)

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permission).toBe(permRow)
    expect(component.changeMode).toBe('EDIT') //   mandatory: false
    expect(component.displayPermissionDetailDialog).toBeTrue()

    component.onDetailPermission(event, { ...permRow, mandatory: true })
    expect(component.changeMode).toBe('VIEW')
  })

  it('should call stopPropagation and set permission in onDeletePermission', () => {
    const event = new MouseEvent('click')
    spyOn(event, 'stopPropagation')

    component.onDeletePermission(event, permRow)

    expect(event.stopPropagation).toHaveBeenCalled()
    expect(component.permission).toBe(permRow)
    expect(component.changeMode).toBe('DELETE')
    expect(component.displayPermissionDeleteDialog).toBeTrue()
  })

  /****************************************************************************
   *  ASSIGNMENTS    => grant + revoke permissions => assign roles
   ****************************************************************************
   */
  it('should create an assignment', () => {
    component.onAssignPermission(permRow, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_SUCCESS' })
  })

  it('should display error if assignment fails', () => {
    const errorResponse = { error: 'Error on creating an assignment', status: 400 }
    assApiSpy.createAssignment.and.returnValue(throwError(() => errorResponse))
    spyOn(console, 'error')

    component.onAssignPermission(permRow, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
    expect(console.error).toHaveBeenCalledWith('createAssignment', errorResponse)
  })

  it('should delete an assignment', () => {
    component.onRemovePermission(permRow, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_SUCCESS' })
  })

  it('should display error if assignment creation fails', () => {
    const errorResponse = { error: 'Error on removing a permission', status: 400 }
    assApiSpy.deleteAssignment.and.returnValue(throwError(() => errorResponse))
    spyOn(console, 'error')

    component.onRemovePermission(permRow, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
    expect(console.error).toHaveBeenCalledWith('deleteAssignment', errorResponse)
  })

  it('should grant all permissions: assign all perms of an app to a role', () => {
    const ev = new MouseEvent('click')
    component.filterAppValue = 'appId1'

    component.ngOnInit()
    component.onGrantAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ALL_SUCCESS' })
  })

  it('should display error when trying to grant all permissions: assign all perms of an app to a role', () => {
    const errorResponse = { error: 'Error on grant all permissions with app filter', status: 400 }
    assApiSpy.grantRoleApplicationAssignments.and.returnValue(throwError(() => errorResponse))
    spyOn(console, 'error')
    const ev = new MouseEvent('click')
    component.filterAppValue = 'appId1'

    component.ngOnInit()
    component.onGrantAllPermissions(ev, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
    expect(console.error).toHaveBeenCalledWith('grantRoleApplicationAssignments', errorResponse)
  })

  it('should grant all permissions: assign all perms of all apps of a product to a role', () => {
    const ev = new MouseEvent('click')
    component.filterProductValue = 'productAppId'

    component.ngOnInit()
    component.onGrantAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ALL_SUCCESS' })
  })

  it('should display error when trying to grant all permissions: assign all perms of all apps of a product to a role', () => {
    const errorResponse = { error: 'Error on grant all permissions with product filter', status: 400 }
    assApiSpy.grantRoleProductsAssignments.and.returnValue(throwError(() => errorResponse))
    spyOn(console, 'error')
    const ev = new MouseEvent('click')
    component.filterProductValue = 'productAppId'

    component.ngOnInit()
    component.onGrantAllPermissions(ev, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
    expect(console.error).toHaveBeenCalledWith('grantRoleProductsAssignments', errorResponse)
  })

  it('should grant all permissions: assign all perms of all apps of a product to a role', () => {
    const ev = new MouseEvent('click')

    component.ngOnInit()
    component.onGrantAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ALL_SUCCESS' })
  })

  it('should revoke all permissions: remove all perms of an app to a role', () => {
    const ev = new MouseEvent('click')
    component.filterAppValue = 'appId1'

    component.ngOnInit()
    component.onRevokeAllPermissions(ev, role1)

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ALL_SUCCESS' })
  })

  it('should display error when trying to revoke all permissions: remove all perms of an app to a role', () => {
    const errorResponse = { error: 'Error on revoke all permissions with app filter', status: 400 }
    assApiSpy.revokeRoleApplicationAssignments.and.returnValue(throwError(() => errorResponse))
    spyOn(console, 'error')
    const ev = new MouseEvent('click')
    component.filterAppValue = 'appId1'

    component.ngOnInit()
    component.onRevokeAllPermissions(ev, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
    expect(console.error).toHaveBeenCalledWith('revokeRoleApplicationAssignments', errorResponse)
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
      { label: 'prodName1', value: 'prodName1' },
      { label: 'prodName2', value: 'prodName2' }
    ]
    component.filterProductValue = undefined
    component.currentApp.isProduct = false

    const res = component['prepareProductListForBulkOperation']()

    expect(res).toEqual(['prodName1', 'prodName2'])
  })

  it('should display error when trying to revoke all permissions: remove all assgmts of all apps of a product to a role', () => {
    const errorResponse = { error: 'Error on revoke all permissions with product filter', status: 400 }
    assApiSpy.revokeRoleProductsAssignments.and.returnValue(throwError(() => errorResponse))
    spyOn(console, 'error')
    const ev = new MouseEvent('click')
    component.filterProductValue = 'productAppId'

    component.ngOnInit()
    component.onRevokeAllPermissions(ev, role1)

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
    expect(console.error).toHaveBeenCalledWith('revokeRoleProductsAssignments', errorResponse)
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
      appDisplayName: 'appName1',
      productDisplayName: 'prodName1'
    }
    const permRow4: PermissionViewRow = {
      ...perm3,
      key: 'key',
      roles: { undefined },
      appType: 'MFE',
      appDisplayName: 'appName1',
      productDisplayName: 'prodName1'
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
