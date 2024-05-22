import { NO_ERRORS_SCHEMA } from '@angular/core'
import { Location } from '@angular/common'
import { HttpClientTestingModule } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { ActivatedRouteSnapshot, ParamMap, Router } from '@angular/router'
import { ActivatedRoute } from '@angular/router'
import { RouterTestingModule } from '@angular/router/testing'
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
  AssignmentPageResult
} from 'src/app/shared/generated'
import { App, AppDetailComponent, PermissionViewRow } from './app-detail.component'
import { PortalMessageService, UserService } from '@onecx/portal-integration-angular'
import { HttpErrorResponse } from '@angular/common/http'
import { Table } from 'primeng/table'

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
const wsDetails: WorkspaceDetails = {
  workspaceRoles: ['role1', 'role2'],
  products: [prodDetails]
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
  productDisplayName: 'prodName'
}

const permRow2: PermissionViewRow = {
  ...perm1,
  key: 'key',
  roles: { undefined },
  appType: 'MFE',
  appDisplayName: 'appName',
  productDisplayName: 'prodName'
}

const assgmt1 = {
  appId: 'appId1'
}
const assgmt2 = {
  appId: 'appId2'
}
const assgmtPageRes: AssignmentPageResult = {
  stream: [assgmt1, assgmt2]
}

describe('AppDetailComponent', () => {
  let component: AppDetailComponent
  let fixture: ComponentFixture<AppDetailComponent>
  let mockActivatedRoute: ActivatedRoute = {
    snapshot: {
      paramMap: {
        get: (key: string) => 'product'
      } as ParamMap
    } as ActivatedRouteSnapshot
  } as ActivatedRoute
  let mockRouter = { navigate: jasmine.createSpy('navigate') }

  const appApiSpy = jasmine.createSpyObj<ApplicationAPIService>('ApplicationAPIService', ['searchApplications'])
  const assApiSpy = jasmine.createSpyObj<AssignmentAPIService>('AssignmentAPIService', [
    'searchAssignments',
    'createAssignment',
    'deleteAssignment',
    'grantAssignments'
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
    assApiSpy.grantAssignments.and.returnValue(of({}) as any)
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

    component.ngOnInit()

    let actions: any = []
    component.actions$!.subscribe((act) => (actions = act))

    actions[0].actionCallback()
    actions[1].actionCallback()

    expect(locationSpy.back).toHaveBeenCalled()
    expect(component.onCreateRole).toHaveBeenCalled()
  })

  it('should loadData onReload', () => {
    spyOn(component as any, 'loadData')

    component.onReload()

    expect((component as any).loadData).toHaveBeenCalled()
  })

  /**
   * loadData
   */

  it('should loadProductDetails successfully', () => {
    const loadedApp: App = { ...app, appType: 'PRODUCT', isProduct: true }
    loadedApp.name = loadedApp.productName

    component.ngOnInit()

    expect(component.currentApp).toEqual(loadedApp)
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

    component.ngOnInit()

    expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_' + err.status + '.WORKSPACE')
  })

  xit('should catch non-HttpErrorResponse error if workspace detail load fails', () => {
    component.urlParamAppType = 'WORKSPACE'
    const nonHttpError = { message: 'non-HTTP error' }
    wsApiSpy.getDetailsByWorkspaceName.and.returnValue(throwError(() => nonHttpError))

    component.ngOnInit()

    expect(component.loadingExceptionKey).toBe('EXCEPTIONS.HTTP_STATUS_0.WORKSPACE')
  })

  /**
   * COLUMNS => Roles, ROWS => Permissions
   */

  /*
   * Table Filter
   */

  it('should set filterBy to ["action", "resource"] and filterValue to an empty string when "ALL" is selected', () => {
    component.onQuickFilterChange({ value: 'ALL' })

    expect(component.filterBy).toEqual(['action', 'resource'])
    expect(component.filterValue).toBe('')
  })

  it('should set filterBy to ["action"] and filterValue to quick filter value ', () => {
    component.onQuickFilterChange({ value: 'VIEW' })

    expect(component.filterBy).toEqual(['action'])
    expect(component.filterValue).toBe('VIEW')
  })

  it('should set the permissionTableFilterInput value and call tableFilter when permissionTableFilterInput and permissionTable are present', () => {
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

  /*
   *  ROLE
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
   *  PERMISSION
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
})
