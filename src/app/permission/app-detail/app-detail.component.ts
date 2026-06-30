import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { CommonModule, Location } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { Subject, catchError, combineLatest, from, map, of, Observable, take } from 'rxjs'

import { FilterMatchMode, SelectItem } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { CheckboxModule } from 'primeng/checkbox'
import { FloatLabelModule } from 'primeng/floatlabel'
import { InputGroupModule } from 'primeng/inputgroup'
import { InputGroupAddonModule } from 'primeng/inputgroupaddon'
import { InputTextModule } from 'primeng/inputtext'
import { MessageModule } from 'primeng/message'
import { SelectButtonModule } from 'primeng/selectbutton'
import { SelectModule } from 'primeng/select'
import { Table, TableModule } from 'primeng/table'
import { TooltipModule } from 'primeng/tooltip'

import { PortalMessageService, UserService } from '@onecx/angular-integration-interface'
import { Action, AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { PortalPageComponent } from '@onecx/angular-utils'

import {
  Role,
  CreateRoleRequest,
  RolePageResult,
  PermissionPageResult,
  Permission,
  Assignment,
  CreateAssignmentRequestParams,
  GrantRoleApplicationAssignmentsRequestParams,
  GrantRoleProductsAssignmentsRequestParams,
  RevokeRoleProductsAssignmentsRequestParams,
  RevokeRoleApplicationAssignmentsRequestParams,
  DeleteAssignmentRequestParams,
  MfeMsAbstract,
  Application,
  ApplicationAPIService,
  AssignmentAPIService,
  PermissionAPIService,
  RoleAPIService,
  WorkspaceAPIService,
  WorkspaceDetails,
  ProductDetails
} from 'src/app/shared/generated'
import { Utils } from 'src/app/shared/utils'

import { PermissionDeleteComponent } from 'src/app/permission/permission-delete/permission-delete.component'
import { PermissionDetailComponent } from 'src/app/permission/permission-detail/permission-detail.component'
import { PermissionExportComponent } from 'src/app/permission/permission-export/permission-export.component'
import { RoleDeleteComponent } from 'src/app/permission/role-delete/role-delete.component'
import { RoleDetailComponent } from 'src/app/permission/role-detail/role-detail.component'
import { RoleIdmComponent } from 'src/app/permission/role-idm/role-idm.component'

export type App = Application & {
  isProduct: boolean
  appType: AppType
  apps?: string[]
  workspaceDetails?: WorkspaceDetails
}
export type AppType = 'WORKSPACE' | 'PRODUCT'
export type ServiceAppType = 'MFE' | 'MS'
export type RoleAssignments = { [key: string]: string | undefined } // assignment id or undefined
export type ChangeMode = 'VIEW' | 'CREATE' | 'EDIT' | 'COPY' | 'DELETE'
export type PermissionViewRow = Permission & {
  key: string // combined resource and action => resource#action
  roles: RoleAssignments
  appType: ServiceAppType
  appDisplayName: string
  productDisplayName: string
}
export type PermissionRole = Role & { isWorkspaceRole: boolean | undefined; hasAssignments?: boolean }

@Component({
  standalone: true,
  imports: [
    AngularAcceleratorModule,
    PortalPageComponent,
    CommonModule,
    FormsModule,
    TranslateModule,
    ButtonModule,
    CheckboxModule,
    FloatLabelModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputTextModule,
    MessageModule,
    SelectButtonModule,
    SelectModule,
    TableModule,
    TooltipModule,
    RoleDeleteComponent,
    RoleDetailComponent,
    RoleIdmComponent,
    PermissionDeleteComponent,
    PermissionDetailComponent,
    PermissionExportComponent
  ],
  templateUrl: './app-detail.component.html',
  styleUrls: ['./app-detail.component.scss']
})
export class AppDetailComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject()
  private readonly debug = true // to be removed after finalization
  private readonly relevantPermissions = [
    'ROLE#EDIT',
    'ROLE#CREATE',
    'ROLE#DELETE',
    'PERMISSION#EDIT',
    'PERMISSION#CREATE',
    'PERMISSION#DELETE',
    'PERMISSION#GRANT'
  ]
  // dialog control
  public loadingApp = true
  public loadingPermissions = true
  public exceptionKey: string | undefined = undefined
  public actions$: Observable<Action[]> | undefined
  // filter row
  public filterBy = ['action', 'resource']
  private readonly permissionFilterFields = ['action', 'resource']
  public filterNot = false
  public filterValue: string | undefined
  public filterMode: string
  public readonly filterModeContains = FilterMatchMode.CONTAINS
  public readonly filterModeNotContains = FilterMatchMode.NOT_CONTAINS
  public quickFilterValue: 'ALL' | 'DELETE' | 'EDIT' | 'VIEW' | 'OTHERS' = 'ALL'
  public quickFilterItems$: Observable<SelectItem[]> | undefined

  @ViewChild('permissionTable') permissionTable: Table | undefined
  @ViewChild('permissionNameFilter') permissionNameFilter: ElementRef | undefined
  @ViewChild('filterProduct') filterProduct: ElementRef | undefined
  @ViewChild('filterApp') filterApp: ElementRef | undefined
  @ViewChild('sortIconAppId') sortIconAppId: ElementRef | undefined
  @ViewChild('sortIconProduct') sortIconProduct: ElementRef | undefined

  // data
  private readonly pageSize = 1000
  public urlParamAppId: string | null
  public urlParamAppType: string | undefined
  public currentApp: App = { appId: 'dummy', appType: 'PRODUCT', isProduct: true } as App
  public dateFormat = 'medium'
  public changeMode: ChangeMode = 'VIEW'
  public myPermissions = new Array<string>() // permissions of the user
  // permission filter
  public filterProductItems!: SelectItem[]
  public filterProductValue: string | undefined = undefined
  public filterAppItems!: SelectItem[]
  public filterAppValue: string | undefined = undefined
  public productApps: App[] = []
  public productNames: string[] = []
  public listedProductsHeaderKey: string = ''

  // permission management
  private permissions$!: Observable<Permission[]>
  public permissions!: Permission[]
  public permission: PermissionViewRow | undefined
  public permissionRows!: PermissionViewRow[]
  public permissionRow: PermissionViewRow | undefined // working row
  public permissionDefaultRoles: RoleAssignments = {} // used initially on row creation
  public displayApplicationDeleteDialog = false
  public displayPermissionDetailDialog = false
  public displayPermissionDeleteDialog = false
  public displayPermissionExportDialog = false
  public displayAdditionalRowData = false
  public showPermissionTools = false
  public hideEmptyRoles = false
  public emptyRolesExist = false
  public showNonWorkspaceRoles = false
  public protectedAssignments: Array<string> = []

  // role management
  private roles$!: Observable<PermissionRole[]>
  public role: Role | undefined
  public roles: PermissionRole[] = []
  public rolesFiltered: PermissionRole[] = []
  public missingWorkspaceRoles = false
  public displayRoleDetailDialog = false
  public displayRoleDeleteDialog = false
  public displayIdmRolesDialog = false
  public showRoleTools = false

  constructor(
    private readonly appApi: ApplicationAPIService,
    private readonly assApi: AssignmentAPIService,
    private readonly permApi: PermissionAPIService,
    private readonly roleApi: RoleAPIService,
    private readonly workspaceApi: WorkspaceAPIService,
    private readonly route: ActivatedRoute,
    private readonly location: Location,
    private readonly translate: TranslateService,
    private readonly msgService: PortalMessageService,
    private readonly userService: UserService
  ) {
    this.urlParamAppId = this.route.snapshot.paramMap.get('appId')
    this.urlParamAppType = this.route.snapshot.paramMap.get('appType')?.toUpperCase()
    this.dateFormat = this.userService.lang$.getValue() === 'de' ? 'dd.MM.yyyy HH:mm' : 'medium'
    this.filterMode = FilterMatchMode.CONTAINS
  }

  public ngOnInit(): void {
    this.getMyPermissions()
      .pipe(take(1))
      .subscribe((permissions) => {
        this.myPermissions = permissions
        this.initializeComponent()
      })
  }

  public ngOnDestroy(): void {
    this.destroy$.next(undefined)
    this.destroy$.complete()
  }

  private getMyPermissions(): Observable<string[]> {
    const userService = this.userService
    if (typeof userService.getPermissions === 'function') {
      const permissions$ = userService.getPermissions()
      if (permissions$ && typeof permissions$.pipe === 'function') {
        return permissions$.pipe(
          map((permissions: string[]) => this.relevantPermissions.filter((p) => permissions.includes(p)))
        )
      }
    }
    if (typeof userService.hasPermission === 'function') {
      const checks = this.relevantPermissions.map((p) => userService.hasPermission(p))
      const hasAsyncCheck = checks.some((check) => check && typeof check.then === 'function')
      if (!hasAsyncCheck) {
        return of(this.relevantPermissions.filter((_, index) => !!checks[index]))
      }
      return from(
        Promise.all(
          this.relevantPermissions.map((permission, index) =>
            Promise.resolve(checks[index]).then((hasPermission) => ({
              permission,
              hasPermission
            }))
          )
        ).then((checks) => checks.filter((check) => check.hasPermission).map((check) => check.permission))
      )
    }
    return of([])
  }

  private initializeComponent(): void {
    if (
      this.myPermissions.includes('ROLE#EDIT') ||
      this.myPermissions.includes('ROLE#CREATE') ||
      this.myPermissions.includes('ROLE#DELETE')
    )
      this.myPermissions.push('ROLE#MANAGE')
    if (
      this.myPermissions.includes('PERMISSION#EDIT') ||
      this.myPermissions.includes('PERMISSION#CREATE') ||
      this.myPermissions.includes('PERMISSION#DELETE')
    )
      this.myPermissions.push('PERMISSION#MANAGE')
    this.prepareQuickFilterItems()
    this.prepareActionButtons()
    this.loadData()
  }

  public prepareQuickFilterItems(): void {
    this.quickFilterItems$ = this.translate
      .get([
        'DIALOG.DETAIL.QUICK_FILTER.ALL',
        'DIALOG.DETAIL.QUICK_FILTER.DELETE',
        'DIALOG.DETAIL.QUICK_FILTER.EDIT',
        'DIALOG.DETAIL.QUICK_FILTER.READ',
        'DIALOG.DETAIL.QUICK_FILTER.VIEW',
        'DIALOG.DETAIL.QUICK_FILTER.WRITE'
      ])
      .pipe(
        map((data) => {
          return [
            { label: data['DIALOG.DETAIL.QUICK_FILTER.ALL'], value: 'ALL' },
            { label: data['DIALOG.DETAIL.QUICK_FILTER.DELETE'], value: 'DELETE' },
            { label: data['DIALOG.DETAIL.QUICK_FILTER.EDIT'], value: 'EDIT' },
            { label: data['DIALOG.DETAIL.QUICK_FILTER.READ'], value: 'READ' },
            { label: data['DIALOG.DETAIL.QUICK_FILTER.VIEW'], value: 'VIEW' },
            { label: data['DIALOG.DETAIL.QUICK_FILTER.WRITE'], value: 'WRITE' }
          ]
        })
      )
  }

  private prepareActionButtons(): void {
    this.actions$ = this.translate
      .get([
        'ACTIONS.NAVIGATION.BACK',
        'ACTIONS.NAVIGATION.BACK.TOOLTIP',
        'ACTIONS.EXPORT.LABEL',
        'ACTIONS.EXPORT.ASSIGNMENT.TOOLTIP'
      ])
      .pipe(
        map((data) => {
          return [
            {
              label: data['ACTIONS.NAVIGATION.BACK'],
              title: data['ACTIONS.NAVIGATION.BACK.TOOLTIP'],
              actionCallback: () => this.location.back(),
              icon: 'pi pi-arrow-left',
              show: 'always'
            },
            {
              label: data['ACTIONS.EXPORT.LABEL'],
              title: data['ACTIONS.EXPORT.ASSIGNMENT.TOOLTIP'],
              actionCallback: () => this.onExport(),
              icon: 'pi pi-download',
              show: 'always',
              permission: 'PERMISSION#EDIT',
              conditional: true,
              showCondition: this.exceptionKey === undefined
            }
          ]
        })
      )
  }

  /**
   * UI Events
   */
  public onReload(): void {
    this.onClearTableFilter()
    this.loadData()
  }
  public onExport(): void {
    if (this.currentApp.appType === 'WORKSPACE') {
      this.productNames =
        this.currentApp.workspaceDetails?.products?.map((p) => p.productName!).sort(Utils.sortByLocale) ?? []
      this.listedProductsHeaderKey = 'ACTIONS.EXPORT.WS_APPLICATION_LIST'
    } else if (this.currentApp.isProduct) {
      this.productNames = [this.currentApp.name!]
      this.listedProductsHeaderKey = 'ACTIONS.EXPORT.OF_APPLICATION'
    }
    if (this.productNames.length > 0) this.displayPermissionExportDialog = true
  }

  public onRoleFilterChange(val: string): void {
    if (val !== '' && this.rolesFiltered && this.roles.length > 0)
      this.rolesFiltered = this.roles.filter((r) => r.name!.includes(val))
    else this.rolesFiltered = this.roles
    this.scheduleFrozenColumnsRealign()
  }

  public onRoleFilterInputChange(val: string): void {
    this.onRoleFilterChange(val)
  }

  public onRoleFilterClear(roleNameFilter: HTMLInputElement): void {
    roleNameFilter.value = ''
    this.onRoleFilterChange('')
  }

  public onHideEmptyRolesToggle(): void {
    this.hideEmptyRoles = !this.hideEmptyRoles
    this.scheduleFrozenColumnsRealign()
  }

  public onShowNonWorkspaceRolesToggle(): void {
    this.showNonWorkspaceRoles = !this.showNonWorkspaceRoles
    this.scheduleFrozenColumnsRealign()
  }

  public onRoleInputGroupStateChanged(): void {
    this.scheduleFrozenColumnsRealign()
  }
  private loadData(): void {
    if (!this.urlParamAppId || !this.urlParamAppType) {
      this.exceptionKey = 'EXCEPTIONS.HTTP_MISSING_PARAMETER'
      return
    }
    this.currentApp = {
      id: this.urlParamAppId,
      name: this.urlParamAppId,
      appId: this.urlParamAppId,
      appType: this.urlParamAppType,
      isProduct: this.urlParamAppType === 'PRODUCT'
    } as App
    this.productApps = []
    this.loadingApp = true
    this.exceptionKey = undefined
    this.urlParamAppType === 'WORKSPACE' ? this.loadWorkspaceDetails() : this.loadProductDetails()
  }

  private loadProductDetails() {
    this.appApi
      .searchApplications({ applicationSearchCriteria: { productName: this.urlParamAppId! } })
      .pipe(catchError((error) => of(error)))
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.APP'
          console.error('searchApplications', result)
        } else if (result instanceof Object && result.stream) {
          // expected apps per product: 2 (bff + ui)
          if (result.totalElements === 0) this.exceptionKey = 'EXCEPTIONS.NOT_FOUND.PRODUCT'
          else {
            this.currentApp = { ...result.stream[0], appType: this.urlParamAppType, isProduct: true, apps: [] } as App
            this.currentApp.name = this.currentApp.productName
            result.stream.map((app: Application) => {
              this.currentApp.apps!.push(app.appId!)
              this.productApps.push(app as App)
            })
            this.prepareActionButtons()
            this.loadRolesAndPermissions()
            this.loadingApp = false
          }
        } else {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.APP'
          console.error('searchApplications', result)
        }
      })
  }

  private loadWorkspaceDetails() {
    this.workspaceApi
      .getDetailsByWorkspaceName({ workspaceName: this.currentApp.appId! })
      .pipe(
        catchError((error) => {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.WORKSPACE'
          console.error('getDetailsByWorkspaceName', error)
          return of(error)
        })
      )
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.WORKSPACE'
          console.error('getDetailsByWorkspaceName', result)
        } else if (result instanceof Object) {
          this.currentApp.workspaceDetails = { ...result }
          this.currentApp.workspaceDetails?.products?.map((product) => this.fillProductApps(product))
          this.prepareActionButtons()
          this.loadRolesAndPermissions()
        }
        this.loadingApp = false
      })
  }
  private fillProductApps(product: ProductDetails) {
    if (product.mfe) product.mfe.forEach((app) => this.pushProductApps(product.productName!, app))
    if (product.ms) product.ms.forEach((app) => this.pushProductApps(product.productName!, app))
  }
  private pushProductApps(productName: string, app: MfeMsAbstract) {
    if (this.productApps.filter((aa) => aa.appId === app.appId).length === 0)
      this.productApps.push({ appId: app.appId, name: app.appName, productName: productName } as App)
  }

  /**
   * COLUMNS => Roles, ROWS => Permissions
   */
  private prepareSearchRolesAndPermissions(): void {
    this.roles$ = this.roleApi.searchRoles({ roleSearchCriteria: { pageSize: this.pageSize } }).pipe(
      map((result: RolePageResult) => {
        return result.stream ? result.stream?.map((role) => role as PermissionRole) : []
      }),
      catchError((err) => {
        this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.ROLES'
        console.error('searchRoles', err)
        return of([])
      })
    )
    // search permissions for products (from app or workspace)
    const prodNames: string[] = []
    if (this.currentApp.isProduct) {
      prodNames.push(this.currentApp.productName!)
    } else
      this.currentApp.workspaceDetails?.products?.map((p) => {
        prodNames.push(p.productName!)
      })
    this.permissions$ = this.permApi
      .searchPermissions({
        permissionSearchCriteria: { productNames: prodNames, pageSize: this.pageSize }
      })
      .pipe(
        map((result: PermissionPageResult) => result.stream ?? []),
        catchError((err) => {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS'
          console.error('searchPermissions', err)
          return of([])
        })
      )
  }

  private loadRolesAndPermissions(): void {
    this.roles = []
    this.permissions = []
    this.loadingPermissions = true
    this.prepareSearchRolesAndPermissions()
    combineLatest([this.roles$, this.permissions$]).subscribe(([roles, permissions]) => {
      // filter
      this.prepareFilterProducts()
      this.prepareFilterApps()
      // roles
      this.roles = roles
      this.roles.sort(this.sortRoleByName)
      this.rolesFiltered = this.roles
      this.checkWorkspaceRoles(roles)
      // permissions
      this.permissions = permissions
      this.preparePermissionTable(permissions) // including sort
      this.loadingPermissions = false
    })
  }

  // does the workspace have roles which are not exist in permission product?
  private checkWorkspaceRoles(roles: PermissionRole[]) {
    if (this.currentApp.isProduct) return
    if (this.currentApp.workspaceDetails?.workspaceRoles) {
      roles.forEach((r) => (r.isWorkspaceRole = this.currentApp.workspaceDetails?.workspaceRoles?.includes(r.name!)))
      this.missingWorkspaceRoles =
        roles.filter((r) => r.isWorkspaceRole === true).length !==
        this.currentApp.workspaceDetails?.workspaceRoles.length
    }
  }

  public onCreateWorkspaceRoles(ev: Event) {
    ev.stopPropagation()
    if (!this.missingWorkspaceRoles) return
    // get workspace roles which are not exists within permission product
    const mwr: CreateRoleRequest[] = []
    this.currentApp.workspaceDetails?.workspaceRoles?.map((r) => {
      mwr.push({ name: r } as CreateRoleRequest)
    })
    this.roleApi.createRole({ createRolesRequest: { roles: mwr } }).subscribe({
      next: () => {
        this.msgService.success({ summaryKey: 'ACTIONS.CREATE.MESSAGE.WORKSPACE_ROLES_OK' })
        this.loadRolesAndPermissions()
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'ACTIONS.CREATE.MESSAGE.WORKSPACE_ROLES_NOK' })
        console.error('createRole', err)
      }
    })
  }

  /**
   * FILTER
   */
  private prepareFilterProducts() {
    this.filterProductItems = []
    if (this.currentApp.isProduct) {
      this.filterProductItems.push({
        label: this.currentApp.productName,
        value: this.currentApp.productName
      } as SelectItem)
      return
    }
    if (this.currentApp.workspaceDetails?.products) {
      this.currentApp.workspaceDetails?.products.map((product) => {
        this.filterProductItems.push({ label: product.displayName, value: product.productName })
      })
      this.filterProductItems.sort(Utils.sortSelectItemsByLabel)
    }
  }

  public prepareFilterApps(selectedProductName?: string) {
    this.filterAppItems = []
    // 1. load from permisions
    this.permissions
      // if no product is selected then exclude filtering
      .filter((p) => p.productName === (selectedProductName ?? p.productName))
      .forEach((p) => {
        if (this.filterAppItems.filter((item) => item.value === p.appId).length === 0) {
          const productApp = this.productApps.filter((a) => a.productName === p.productName && a.appId === p.appId)
          this.filterAppItems.push({
            label: productApp.length > 0 ? productApp[0].name : p.appId,
            value: p.appId
          } as SelectItem)
        }
      })
    // 2. add missing apps from product
    this.productApps
      .filter((a) => a.productName === (selectedProductName ?? a.productName))
      .forEach((app) => {
        if (this.filterAppItems.filter((item) => item.value === app.appId).length === 0)
          this.filterAppItems.push({ label: app.name, value: app.appId } as SelectItem)
      })
    this.filterAppItems.sort(Utils.sortSelectItemsByLabel)
  }

  /* 1. Prepare rows of the table: permissions of the <application> as Map
   *    key (resource#action):   'PERMISSION#READ'
   *    value: {resource: 'PERMISSION', action: 'READ', key: 'PERMISSION#READ', name: 'View permission matrix'
   */
  private preparePermissionTable(permissions: Permission[]): void {
    if (permissions.length === 0) {
      console.warn('No permissions found for the apps - stop processing')
      return
    }
    this.permissionRows = []
    for (const perm of permissions) {
      const products = this.filterProductItems.filter((p) => p.value === perm.productName)
      const label = products.length > 0 ? products[0].label : perm.productName
      const apps = this.filterAppItems.filter((p) => p.value === perm.appId)

      this.permissionRows.push({
        ...perm,
        key: perm.resource + '#' + perm.action,
        productDisplayName: this.currentApp.isProduct ? perm.productName : label,
        appDisplayName: apps.length > 0 ? apps[0].label : perm.appId,
        roles: {}
      } as PermissionViewRow)
    }
    this.permissionRows.sort(
      this.currentApp.isProduct ? this.sortPermissionRowByAppIdAsc : this.sortPermissionRowByProductAsc
    )
    this.loadRoleAssignments(true)
  }

  // case 1: all apps on init
  // case 2: the filtered app on reload after change
  // roleId is set only on role action: grant/revoke all
  private loadRoleAssignments(init: boolean, roleId?: string) {
    const appList: string[] = []
    if (this.productApps.length === 0) {
      console.warn('No apps found - stop loading assignments')
      return
    } else if (this.filterAppValue) appList.push(this.filterAppValue)
    else
      this.permissions.forEach((perm) => {
        if (!appList.includes(perm.appId!)) appList.push(perm.appId!)
      })
    if (appList.length > 0 && roleId) {
      this.permissionRows.forEach((p) => {
        if (appList.includes(p.appId!)) p.roles[roleId] = undefined
      })
    }
    this.searchAssignments(init, appList, roleId)
  }

  private searchAssignments(init: boolean, appList: string[], roleId?: string) {
    if (this.roles.length === 0 || this.permissions.length === 0) return
    this.assApi
      .searchAssignments({ assignmentSearchCriteria: { appIds: appList, roleId: roleId, pageSize: this.pageSize } })
      .pipe(catchError((error) => of(error)))
      .subscribe((result) => {
        this.emptyRolesExist = false
        if (result instanceof HttpErrorResponse) {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.ASSIGNMENTS'
          console.error('searchAssignments', result)
        } else if (result instanceof Object && result.stream) {
          if (init) this.protectedAssignments = [] // ids of mandatory assignments
          if (roleId) this.roles.filter((r) => r.id === roleId).forEach((role) => (role.hasAssignments = false))
          // result.stream => assignments => roleId, permissionId, appId
          // this.permissionRows => Permission + key, roles
          // Permission (row): id, appId, resource, action
          let lastRoleId = ''
          result.stream?.forEach((assignment: Assignment) => {
            const permissions = this.permissionRows.filter((p) => p.id === assignment.permissionId)
            if (assignment.mandatory) this.protectedAssignments.push(assignment.id!)
            if (assignment.roleId && lastRoleId !== assignment.roleId) {
              this.roles.find((r) => r.id === assignment.roleId)!.hasAssignments = true
            }
            lastRoleId = assignment.roleId!
            permissions.forEach((perm) => (perm.roles[assignment.roleId!] = assignment.id))
          })
          this.emptyRolesExist = this.roles.some((r) => !r.hasAssignments)
        } else {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.ASSIGNMENTS'
          console.error('searchAssignments', result)
        }
      })
  }

  /*********************************************
   * Table Filter
   */
  public onFilterModeChange(mode?: string): void {
    if (mode === '=') {
      this.filterMode = FilterMatchMode.CONTAINS
    }
    if (mode === '!=') {
      this.filterMode = FilterMatchMode.NOT_CONTAINS
    }
    if (this.permissionNameFilter && this.permissionTable) {
      this.filterValue = this.permissionNameFilter.nativeElement.value
      this.tableFilter(this.filterValue)
    }
  }
  public onQuickFilterChange(val: string): void {
    if (val === 'ALL') {
      this.filterBy = ['action', 'resource']
      this.filterValue = ''
    } else {
      this.filterBy = ['action']
      this.filterValue = val
    }
    if (this.permissionNameFilter && this.permissionTable) {
      this.permissionNameFilter.nativeElement.value = this.filterValue
      this.tableFilter(this.filterValue)
    }
  }
  public tableFilter(val: string | undefined): void {
    if (this.permissionTable) {
      const activeFilterFields = this.filterBy?.length ? this.filterBy : this.permissionFilterFields

      // Clear stale column/global constraints before reapplying the active mode.
      this.permissionTable.filter?.('', 'global', FilterMatchMode.CONTAINS)
      this.permissionFilterFields.forEach((field) => {
        this.permissionTable?.filter?.('', field, FilterMatchMode.NOT_CONTAINS)
      })

      if (this.filterMode === FilterMatchMode.NOT_CONTAINS) {
        activeFilterFields.forEach((field) => this.permissionTable?.filter?.(val, field, FilterMatchMode.NOT_CONTAINS))
      } else {
        this.permissionTable.filterGlobal?.(val, this.filterMode)
      }
      this.scheduleFrozenColumnsRealign()
    }
  }
  public onClearTableFilter(): void {
    if (this.permissionNameFilter) {
      this.permissionNameFilter.nativeElement.value = ''
      this.quickFilterValue = 'ALL'
      this.filterBy = ['action', 'resource']
      this.filterValue = ''
    }
    this.filterAppValue = undefined
    this.onSortPermissionTable()
    if (this.permissionTable?.clear) this.permissionTable?.clear()
    this.scheduleFrozenColumnsRealign()
  }
  public onSortPermissionTable() {
    // reset icons
    if (this.sortIconAppId) this.sortIconAppId.nativeElement.className = 'pi pi-sort-alt'
    if (this.sortIconProduct) this.sortIconProduct.nativeElement.className = 'pi pi-sort-alt'
    this.scheduleFrozenColumnsRealign()
  }

  public onPermissionTableFiltered() {
    this.scheduleFrozenColumnsRealign()
  }

  public onPermissionTablePaged() {
    this.scheduleFrozenColumnsRealign()
  }

  public onPermissionToolsToggle() {
    this.showPermissionTools = !this.showPermissionTools
    this.scheduleFrozenColumnsRealign()
  }

  public onRoleToolsToggle() {
    this.showRoleTools = !this.showRoleTools
    this.scheduleFrozenColumnsRealign()
  }

  public onDisplayAdditionalRowDataToggle(): void {
    this.scheduleFrozenColumnsRealign()
  }

  /**
   * Filter: Product, AppId
   */
  public onFilterItemSortIcon(ev: Event, icon: HTMLSpanElement, field: string) {
    ev.stopPropagation()
    this.permissionTable?.clear()
    switch (icon.className) {
      case 'pi pi-sort-amount-down':
        icon.className = 'pi pi-sort-amount-up-alt'
        this.permissionTable?._value.sort(
          field === 'appId' ? this.sortPermissionRowByAppIdAsc : this.sortPermissionRowByProductAsc
        )
        break
      case 'pi pi-sort-alt': // init
      case 'pi pi-sort-amount-up-alt':
        icon.className = 'pi pi-sort-amount-down'
        this.permissionTable?._value.sort(
          field === 'appId' ? this.sortPermissionRowByAppIdDesc : this.sortPermissionRowByProductDesc
        )
        break
    }
    this.scheduleFrozenColumnsRealign()
  }
  public onFilterItemClearAppId() {
    this.filterAppValue = undefined
    this.permissionTable?.filter(this.filterAppValue, 'appId', 'notEquals')
    this.scheduleFrozenColumnsRealign()
  }

  // if product name selected then reload app id filter
  public onFilterItemChangeProduct(val: string | undefined) {
    this.filterProductValue = val
    this.filterAppValue = undefined
    this.permissionTable?.filter(this.filterAppValue, 'appId', 'notEquals')
    this.permissionTable?.filter(this.filterProductValue, 'productName', 'equals')
    this.prepareFilterApps(this.filterProductValue)
    this.scheduleFrozenColumnsRealign()
  }

  private scheduleFrozenColumnsRealign(
    requestFrame: typeof requestAnimationFrame | undefined = globalThis.requestAnimationFrame
  ) {
    if (typeof requestFrame !== 'function') return
    setTimeout(() => {
      requestFrame(() => {
        requestFrame(() => this.realignFrozenColumns())
      })
    })
  }

  private realignFrozenColumns() {
    const tableHost = document.getElementById('apm_app_detail_permission_table')
    const table = tableHost?.querySelector('.p-datatable-table') as HTMLTableElement | null
    const headerRow = table?.querySelector('thead > tr') as HTMLTableRowElement | null
    if (!table || !headerRow) return

    const frozenOffsets = new Map<number, number>()
    let leftOffset = 0
    Array.from(headerRow.children).forEach((cell, index) => {
      const headerCell = cell as HTMLElement
      const isFrozen =
        headerCell.classList.contains('p-datatable-frozen-column') || headerCell.classList.contains('p-frozen-column')
      const isVisible = globalThis.getComputedStyle(headerCell).display !== 'none'
      if (!isFrozen || !isVisible) return

      frozenOffsets.set(index, leftOffset)
      leftOffset += headerCell.getBoundingClientRect().width
    })

    Array.from(table.querySelectorAll('thead > tr, tbody > tr')).forEach((row) => {
      const rowCells = Array.from((row as HTMLTableRowElement).children)
      frozenOffsets.forEach((offset, index) => {
        const cell = rowCells[index] as HTMLElement | undefined
        if (!cell) return

        const isFrozen =
          cell.classList.contains('p-datatable-frozen-column') || cell.classList.contains('p-frozen-column')
        const isVisible = globalThis.getComputedStyle(cell).display !== 'none'
        if (isFrozen && isVisible) {
          cell.style.left = `${offset}px`
        }
      })
    })
  }

  /****************************************************************************
   *  ROLE
   ****************************************************************************
   */
  public onCreateRole(ev?: Event): void {
    ev?.stopPropagation()
    this.role = undefined
    this.changeMode = 'CREATE'
    this.displayRoleDetailDialog = true
  }
  public onEditRole(ev: Event, role: Role): void {
    ev.stopPropagation()
    this.role = { ...role }
    this.changeMode = 'EDIT'
    this.displayRoleDetailDialog = true
  }
  public onDeleteRole(ev: Event, role: Role): void {
    ev.stopPropagation()
    this.role = { ...role }
    this.changeMode = 'DELETE'
    this.displayRoleDeleteDialog = true
  }
  public onDeleteRoleChanges(changed: boolean) {
    this.role = undefined
    this.changeMode = 'VIEW'
    this.displayRoleDeleteDialog = false
    if (changed) this.loadData()
  }
  public onChanges(changed: boolean) {
    this.role = undefined
    this.changeMode = 'VIEW'
    this.displayPermissionDetailDialog = false
    this.displayRoleDetailDialog = false
    this.displayRoleDeleteDialog = false
    this.displayIdmRolesDialog = false
    if (changed) this.loadData()
  }
  public onAddIAMRoles(ev: Event) {
    this.displayIdmRolesDialog = true
  }

  /****************************************************************************
   *  PERMISSION
   ****************************************************************************
   */
  public onCopyPermission(ev: Event, perm: PermissionViewRow): void {
    this.onDetailPermission(ev, { ...perm, operator: false })
    this.changeMode = 'CREATE'
  }
  public onCreatePermission(ev?: Event): void {
    ev?.stopPropagation()
    this.role = undefined
    this.changeMode = 'CREATE'
    this.displayPermissionDetailDialog = true
  }
  public onDetailPermission(ev: Event, perm: PermissionViewRow): void {
    ev.stopPropagation()
    this.permission = { ...perm }
    this.changeMode = this.permission.mandatory ? 'VIEW' : 'EDIT'
    this.displayPermissionDetailDialog = true
  }
  public onDeletePermission(ev: Event, perm: PermissionViewRow): void {
    ev.stopPropagation()
    this.permission = { ...perm }
    this.changeMode = 'DELETE'
    this.displayPermissionDeleteDialog = true
  }
  public onDeletePermissionChanges(changed: boolean) {
    this.permission = undefined
    this.changeMode = 'VIEW'
    this.displayPermissionDeleteDialog = false
    if (changed) this.loadData()
  }

  /****************************************************************************
   *  ASSIGNMENTS    => grant + revoke permissions => assign roles
   ****************************************************************************
   */
  public onAssignPermission(ev: Event, permRow: PermissionViewRow, role: Role): void {
    ev.stopPropagation()
    this.assApi
      .createAssignment({
        createAssignmentRequest: {
          roleId: role.id,
          permissionId: permRow.id
        }
      } as CreateAssignmentRequestParams)
      .subscribe({
        next: (data) => {
          this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_SUCCESS' })
          permRow.roles[role.id!] = data.id
          this.roles.find((r) => r.id === role.id)!.hasAssignments = true
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
          console.error('createAssignment', err)
        }
      })
  }
  public onRemovePermission(ev: Event, permRow: PermissionViewRow, role: Role): void {
    ev.stopPropagation()
    this.assApi.deleteAssignment({ id: permRow.roles[role.id!] } as DeleteAssignmentRequestParams).subscribe({
      next: () => {
        this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_SUCCESS' })
        permRow.roles[role.id!] = undefined
        this.roles.find((r) => r.id === role.id)!.hasAssignments = false
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
        console.error('deleteAssignment', err)
      }
    })
  }

  /* GRANT ALL depends on what ALL means:
   * 1. Value in App filter     => assign all permissions of this app to the role
   * 2. Value in Product filter => assign all permissions of all Apps of this product to the role
   * 3. No Product filter       => product list depends on currentApp/AppType:
   * 3.1 If currentApp is PRODUCT then this product must be used
   * 3.2 If currentApp is WORKSPACE then all product are used
   */
  public onGrantAllPermissions(ev: Event, role: Role): void {
    const prodNames = this.prepareProductListForBulkOperation()
    const response = function (outside: AppDetailComponent, fname: string) {
      return {
        next: () => {
          outside.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ALL_SUCCESS' })
          outside.loadRoleAssignments(false, role.id)
        },
        error: (err: unknown) => {
          outside.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
          console.error(fname, err)
        }
      }
    }
    if (this.filterAppValue) {
      if (prodNames.length === 1)
        this.assApi
          .grantRoleApplicationAssignments({
            roleId: role.id,
            createRoleApplicationAssignmentRequest: {
              appId: this.filterAppValue,
              productName: prodNames[0]
            }
          } as GrantRoleApplicationAssignmentsRequestParams)
          .subscribe(response(this, 'grantRoleApplicationAssignments'))
    } else {
      this.assApi
        .grantRoleProductsAssignments({
          roleId: role.id,
          createRoleProductsAssignmentRequest: { productNames: prodNames }
        } as GrantRoleProductsAssignmentsRequestParams)
        .subscribe(response(this, 'grantRoleProductsAssignments'))
    }
  }

  /* REVOKE ALL depends on what ALL means:
     ... see GRANT description above
  */
  public onRevokeAllPermissions(ev: Event, role: Role): void {
    const prodNames = this.prepareProductListForBulkOperation()
    const response = function (outside: AppDetailComponent, fname: string) {
      return {
        next: () => {
          outside.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ALL_SUCCESS' })
          outside.loadRoleAssignments(false, role.id)
        },
        error: (err: unknown) => {
          outside.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
          console.error(fname, err)
        }
      }
    }
    if (this.filterAppValue) {
      if (prodNames.length === 1)
        this.assApi
          .revokeRoleApplicationAssignments({
            roleId: role.id,
            revokeRoleApplicationAssignmentRequest: {
              appId: this.filterAppValue,
              productName: prodNames[0]
            }
          } as RevokeRoleApplicationAssignmentsRequestParams)
          .subscribe(response(this, 'revokeRoleApplicationAssignments'))
    } else {
      this.assApi
        .revokeRoleProductsAssignments({
          roleId: role.id,
          revokeRoleProductsAssignmentRequest: { productNames: prodNames }
        } as RevokeRoleProductsAssignmentsRequestParams)
        .subscribe(response(this, 'revokeRoleProductsAssignments'))
    }
  }

  private prepareProductListForBulkOperation(): string[] {
    const pList: string[] = []
    // case 1: APP filter value =>
    if (this.filterAppValue) {
      const apps = this.productApps.filter((p) => p.appId === this.filterAppValue)
      if (apps.length === 1) pList.push(apps[0].productName!)
      // case 2: PRODUCT
    } else if (this.currentApp.isProduct) pList.push(this.currentApp.productName!)
    // case 3: WORKSPACE
    //      a) selected product
    else if (this.filterProductValue) pList.push(this.filterProductValue)
    //      b) all products
    else if (this.filterProductItems.length > 1)
      this.filterProductItems.forEach((p) => {
        if (p.value) pList.push(p.value) // ignore empty entry
      })
    return pList
  }

  /****************************************************************************
   *  SORT
   */
  private sortPermissionRowByAppIdAsc(a: PermissionViewRow, b: PermissionViewRow): number {
    return (
      (a.appId ? a.appId.toUpperCase() : '').localeCompare(b.appId ? b.appId.toUpperCase() : '') ||
      a.key.localeCompare(b.key)
    )
  }
  private sortPermissionRowByAppIdDesc(bPerm: PermissionViewRow, aPerm: PermissionViewRow): number {
    return (
      (aPerm.appId ? aPerm.appId.toUpperCase() : '').localeCompare(bPerm.appId ? bPerm.appId.toUpperCase() : '') ||
      aPerm.key.localeCompare(bPerm.key)
    )
  }
  private sortPermissionRowByProductAsc(a: PermissionViewRow, b: PermissionViewRow): number {
    return (
      ((a.productName ? a.productName.toUpperCase() : '').localeCompare(
        b.productName ? b.productName.toUpperCase() : ''
      ) ||
        a.appId?.localeCompare(b.appId!)) ??
      a.key.localeCompare(b.key)
    )
  }
  private sortPermissionRowByProductDesc(bP: PermissionViewRow, aP: PermissionViewRow): number {
    return (
      ((aP.productName ? aP.productName.toUpperCase() : '').localeCompare(
        bP.productName ? bP.productName.toUpperCase() : ''
      ) ||
        aP.appId?.localeCompare(bP.appId!)) ??
      aP.key.localeCompare(bP.key)
    )
  }

  private sortRoleByName(a: PermissionRole, b: PermissionRole): number {
    return (a.name ? a.name.toUpperCase() : '').localeCompare(b.name ? b.name.toUpperCase() : '')
  }
}
