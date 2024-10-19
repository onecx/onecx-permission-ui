import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Location } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { TranslateService } from '@ngx-translate/core'
import { Subject, catchError, combineLatest, finalize, map, of, Observable } from 'rxjs'
import { FilterMatchMode, SelectItem } from 'primeng/api'
import { Table } from 'primeng/table'

import { Action, PortalMessageService, UserService } from '@onecx/portal-integration-angular'

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
import { dropDownSortItemsByLabel, limitText, sortByLocale } from 'src/app/shared/utils'

export type App = Application & {
  isProduct: boolean
  appType: AppType
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
export type PermissionRole = Role & { isWorkspaceRole: boolean | undefined }

@Component({
  templateUrl: './app-detail.component.html',
  styleUrls: ['./app-detail.component.scss']
})
export class AppDetailComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject()
  private readonly debug = true // to be removed after finalization
  limitText = limitText
  // dialog control
  public loading = true
  public loadingExceptionKey = ''
  public actions$: Observable<Action[]> | undefined
  // filter row
  public filterBy = ['action', 'resource']
  public filterNot = false
  public filterValue: string | undefined
  public filterMode: string
  public quickFilterValue: 'ALL' | 'DELETE' | 'EDIT' | 'VIEW' | 'OTHERS' = 'ALL'
  public quickFilterItems: SelectItem[]

  @ViewChild('permissionTable') permissionTable: Table | undefined
  @ViewChild('permissionTableFilterInput') permissionTableFilterInput: ElementRef | undefined
  @ViewChild('filterProduct') filterProduct: ElementRef | undefined
  @ViewChild('filterApp') filterApp: ElementRef | undefined
  @ViewChild('sortIconAppId') sortIconAppId: ElementRef | undefined
  @ViewChild('sortIconProduct') sortIconProduct: ElementRef | undefined

  // data
  private pageSize = 1000
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
  private productApps: App[] = []
  public productNames: string[] = []
  public listedProductsHeader: string = ''

  // permission management
  private permissions$!: Observable<PermissionPageResult>
  public permissions!: Permission[]
  public permission: PermissionViewRow | undefined
  public permissionRows!: PermissionViewRow[]
  public permissionRow: PermissionViewRow | undefined // working row
  public permissionDefaultRoles: RoleAssignments = {} // used initially on row creation
  public showPermissionDetailDialog = false
  public showPermissionDeleteDialog = false
  public displayExportDialog = false
  public showPermissionTools = false
  public protectedAssignments: Array<string> = []

  // role management
  private roles$!: Observable<RolePageResult>
  public roles!: PermissionRole[]
  public role: Role | undefined
  public missingWorkspaceRoles = false
  public showRoleDetailDialog = false
  public showRoleDeleteDialog = false
  public showIamRolesDialog = false
  public showRoleTools = false

  constructor(
    private appApi: ApplicationAPIService,
    private assApi: AssignmentAPIService,
    private permApi: PermissionAPIService,
    private roleApi: RoleAPIService,
    private workspaceApi: WorkspaceAPIService,
    private route: ActivatedRoute,
    private location: Location,
    private translate: TranslateService,
    private msgService: PortalMessageService,
    private userService: UserService
  ) {
    this.urlParamAppId = this.route.snapshot.paramMap.get('appId')
    this.urlParamAppType = this.route.snapshot.paramMap.get('appType')?.toUpperCase()
    this.dateFormat = this.userService.lang$.getValue() === 'de' ? 'dd.MM.yyyy HH:mm' : 'medium'
    // simplify permission checks
    if (userService.hasPermission('ROLE#EDIT')) this.myPermissions.push('ROLE#EDIT')
    if (userService.hasPermission('ROLE#CREATE')) this.myPermissions.push('ROLE#CREATE')
    if (userService.hasPermission('ROLE#DELETE')) this.myPermissions.push('ROLE#DELETE')
    if (userService.hasPermission('PERMISSION#EDIT')) this.myPermissions.push('PERMISSION#EDIT')
    if (userService.hasPermission('PERMISSION#CREATE')) this.myPermissions.push('PERMISSION#CREATE')
    if (userService.hasPermission('PERMISSION#DELETE')) this.myPermissions.push('PERMISSION#DELETE')
    if (userService.hasPermission('PERMISSION#GRANT')) this.myPermissions.push('PERMISSION#GRANT')
    if (
      userService.hasPermission('ROLE#EDIT') ||
      userService.hasPermission('ROLE#CREATE') ||
      userService.hasPermission('ROLE#DELETE')
    )
      this.myPermissions.push('ROLE#MANAGE')
    if (
      userService.hasPermission('PERMISSION#EDIT') ||
      userService.hasPermission('PERMISSION#CREATE') ||
      userService.hasPermission('PERMISSION#DELETE')
    )
      this.myPermissions.push('PERMISSION#MANAGE')

    this.filterMode = FilterMatchMode.CONTAINS
    this.quickFilterItems = [
      { label: 'DIALOG.DETAIL.QUICK_FILTER.ALL', value: 'ALL' },
      { label: 'DIALOG.DETAIL.QUICK_FILTER.DELETE', value: 'DELETE' },
      { label: 'DIALOG.DETAIL.QUICK_FILTER.EDIT', value: 'EDIT' },
      { label: 'DIALOG.DETAIL.QUICK_FILTER.READ', value: 'READ' },
      { label: 'DIALOG.DETAIL.QUICK_FILTER.VIEW', value: 'VIEW' },
      { label: 'DIALOG.DETAIL.QUICK_FILTER.WRITE', value: 'WRITE' }
    ]
  }

  public ngOnInit(): void {
    this.prepareActionButtons()
    this.loadData()
  }
  public ngOnDestroy(): void {
    this.destroy$.next(undefined)
    this.destroy$.complete()
  }

  private prepareActionButtons(): void {
    this.actions$ = this.translate
      .get([
        'ACTIONS.NAVIGATION.BACK',
        'ACTIONS.NAVIGATION.BACK.TOOLTIP',
        'ACTIONS.CREATE.PERMISSION',
        'ACTIONS.CREATE.PERMISSION.TOOLTIP',
        'ACTIONS.CREATE.ROLE',
        'ACTIONS.CREATE.ROLE.TOOLTIP',
        'ACTIONS.DELETE.LABEL',
        'ACTIONS.DELETE.APP',
        'APP.TYPE',
        'ACTIONS.EXPORT.LABEL',
        'ACTIONS.EXPORT.ASSIGNMENT.TOOLTIP'
      ])
      .pipe(
        map((data) => {
          return [
            {
              label: data['ACTIONS.NAVIGATION.BACK'],
              title: data['ACTIONS.NAVIGATION.BACK.TOOLTIP'],
              actionCallback: () => this.onClose(),
              icon: 'pi pi-arrow-left',
              show: 'always'
            },
            {
              label: data['ACTIONS.EXPORT.LABEL'],
              title: data['ACTIONS.EXPORT.ASSIGNMENT.TOOLTIP'],
              actionCallback: () => this.onExport(),
              icon: 'pi pi-download',
              show: 'always',
              permission: 'PERMISSION#EDIT'
            },
            {
              label: data['ACTIONS.CREATE.ROLE'],
              title: data['ACTIONS.CREATE.ROLE.TOOLTIP'],
              actionCallback: () => this.onCreateRole(),
              icon: 'pi pi-plus',
              show: 'asOverflow',
              permission: 'ROLE#EDIT'
            }
          ]
        })
      )
  }

  /**
   * UI Events
   */
  private onClose(): void {
    this.location.back()
  }
  public onReload(): void {
    this.loadData()
  }
  public onExport(): void {
    if (this.currentApp.appType === 'WORKSPACE') {
      this.currentApp.workspaceDetails?.products?.forEach((detail) => {
        this.productNames.push(detail.productName!)
      })
      this.productNames.sort(sortByLocale)
      this.listedProductsHeader = 'ACTIONS.EXPORT.WS_APPLICATION_LIST'
    } else if (this.currentApp.appType === 'PRODUCT') {
      this.productNames = [this.currentApp.name!]
      this.listedProductsHeader = 'ACTIONS.EXPORT.OF_APPLICATION'
    }
    this.displayExportDialog = true
  }

  private loadData(): void {
    if (!this.urlParamAppId || !this.urlParamAppType) {
      this.loadingExceptionKey = 'EXCEPTIONS.HTTP_MISSING_PARAMETER'
      return
    }
    this.loading = true
    this.loadingExceptionKey = ''
    this.currentApp = {
      id: this.urlParamAppId,
      name: this.urlParamAppId,
      appId: this.urlParamAppId,
      appType: this.urlParamAppType,
      isProduct: this.urlParamAppType !== 'WORKSPACE'
    } as App
    this.productApps = []
    this.urlParamAppType === 'WORKSPACE' ? this.loadWorkspaceDetails() : this.loadProductDetails()
  }
  private loadProductDetails() {
    this.appApi
      .searchApplications({ applicationSearchCriteria: { productName: this.urlParamAppId! } })
      .pipe(catchError((error) => of(error)))
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.APP'
          console.error('searchApplications() result:', result)
        } else if (result instanceof Object && result.stream) {
          this.currentApp = { ...result.stream[0], appType: this.urlParamAppType, isProduct: true } as App
          this.currentApp.name = this.currentApp.productName
          result.stream.map((app: Application) => this.productApps.push(app as App))
          this.prepareActionButtons()
          this.loadRolesAndPermissions()
        } else {
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.APP'
          console.error('getApplicationById() => unknown response:', result)
        }
        this.loading = false
      })
  }
  private loadWorkspaceDetails() {
    this.workspaceApi
      .getDetailsByWorkspaceName({ workspaceName: this.currentApp.appId! })
      .pipe(
        catchError((error) => {
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.WORKSPACE'
          console.error('getDetailsByWorkspaceName() => unknown response:', error)
          return of(error)
        })
      )
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.WORKSPACE'
          console.error('getDetailsByWorkspaceName() result:', result)
        } else if (result instanceof Object) {
          this.currentApp.workspaceDetails = { ...result }
          this.currentApp.workspaceDetails?.products?.map((product) => this.fillProductApps(product))
          this.prepareActionButtons()
          this.loadRolesAndPermissions()
        }
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
  private searchRoles(): Observable<Role[]> {
    this.roles$ = this.roleApi.searchRoles({ roleSearchCriteria: {} }).pipe(
      catchError((err) => {
        this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.ROLES'
        console.error('searchRoles():', err)
        return of({} as RolePageResult)
      }),
      finalize(() => (this.loading = false))
    )
    return this.roles$.pipe(
      map((result: any) => {
        return result.stream
          ? result.stream?.map((role: PermissionRole) => {
              this.roles.push(role)
              return role
            })
          : []
      })
    )
  }
  private searchPermissions(): Observable<Permission[]> {
    const productNames: string[] = []
    if (this.currentApp.isProduct) {
      productNames.push(this.currentApp.productName ?? '')
    } else
      this.currentApp.workspaceDetails?.products?.map((p) => {
        productNames.push(p.productName ?? '')
      })
    this.permissions$ = this.permApi
      .searchPermissions({
        permissionSearchCriteria: {
          productNames: productNames,
          pageSize: this.pageSize
        }
      })
      .pipe(
        catchError((err) => {
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS'
          console.error('searchPermissions():', err)
          return of({} as PermissionPageResult)
        })
      )
    return this.permissions$.pipe(
      map((result: any) => {
        return result.stream
          ? result.stream?.map((perm: Permission) => {
              this.permissions.push(perm)
              return perm
            })
          : []
      })
    )
  }
  private loadRolesAndPermissions(): void {
    this.roles = []
    this.permissions = []
    combineLatest([this.searchRoles(), this.searchPermissions()]).subscribe(
      () => {}, // next
      () => {}, // error
      () => {
        this.checkWorkspaceRoles()
        this.roles.sort(this.sortRoleByName)
        this.prepareFilterProducts()
        this.prepareFilterApps()
        this.preparePermissionTable()
      }
    )
  }
  // does the workspace have roles which are not exist in permission product?
  private checkWorkspaceRoles() {
    if (this.currentApp.isProduct) return
    if (this.currentApp.workspaceDetails?.workspaceRoles) {
      this.roles.forEach(
        (r) => (r.isWorkspaceRole = this.currentApp.workspaceDetails?.workspaceRoles?.includes(r.name!))
      )
      this.missingWorkspaceRoles =
        this.roles.filter((r) => r.isWorkspaceRole === true).length !==
        this.currentApp.workspaceDetails?.workspaceRoles.length
    }
  }

  public onCreateWorkspaceRoles(ev: MouseEvent) {
    ev.stopPropagation()
    if (!this.missingWorkspaceRoles) return
    // get workspace roles which are not exists within permission product
    const mwr: CreateRoleRequest[] = []
    this.currentApp.workspaceDetails?.workspaceRoles?.map((r) => {
      mwr.push({ name: r } as CreateRoleRequest)
    })
    this.roleApi.createRole({ createRolesRequest: { roles: mwr } }).subscribe({
      next: () => {
        this.msgService.success({ summaryKey: 'ACTIONS.ROLE.MESSAGE.WORKSPACE_ROLES_OK' })
        this.loadRolesAndPermissions()
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'ACTIONS.ROLE.MESSAGE.WORKSPACE_ROLES_NOK' })
        console.error(err)
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
      this.filterProductItems.sort(dropDownSortItemsByLabel)
    }
  }

  private prepareFilterApps(selectedProductName?: string) {
    this.filterAppItems = []
    // 1. load from permisions
    this.permissions
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
    this.filterAppItems.sort(dropDownSortItemsByLabel)
  }

  /* 1. Prepare rows of the table: permissions of the <application> as Map
   *    key (resource#action):   'PERMISSION#READ'
   *    value: {resource: 'PERMISSION', action: 'READ', key: 'PERMISSION#READ', name: 'View permission matrix'
   */
  private preparePermissionTable(): void {
    if (this.permissions.length === 0) {
      console.warn('No permissions found for the apps - stop processing')
      return
    }
    this.permissionRows = []
    for (const perm of this.permissions) {
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
    this.assApi
      .searchAssignments({ assignmentSearchCriteria: { appIds: appList, roleId: roleId, pageSize: this.pageSize } })
      .pipe(catchError((error) => of(error)))
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.ASSIGNMENTS'
          console.error('searchAssignments() result:', result)
        } else if (result instanceof Object && result.stream) {
          if (init) this.protectedAssignments = [] // ids of mandatory assignments
          // result.stream => assignments => roleId, permissionId, appId
          // this.permissionRows => Permission + key, roles
          // Permission (row): id, appId, resource, action
          result.stream?.forEach((assignment: Assignment) => {
            const permissions = this.permissionRows.filter((p) => p.id === assignment.permissionId)
            if (assignment.mandatory) this.protectedAssignments.push(assignment.id!)
            permissions.forEach((perm) => (perm.roles[assignment.roleId!] = assignment.id))
          })
          this.loading = false
        } else {
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.ASSIGNMENTS'
          console.error('searchAssignments() => unknown response:', result)
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
    if (this.permissionTableFilterInput && this.permissionTable) {
      this.filterValue = this.permissionTableFilterInput.nativeElement.value
      this.tableFilter(this.filterValue)
    }
  }
  public onQuickFilterChange(ev: any): void {
    if (ev.value === 'ALL') {
      this.filterBy = ['action', 'resource']
      this.filterValue = ''
    } else {
      this.filterBy = ['action']
      this.filterValue = ev.value
    }
    if (this.permissionTableFilterInput && this.permissionTable) {
      this.permissionTableFilterInput.nativeElement.value = this.filterValue
      this.tableFilter(this.filterValue)
    }
  }
  public tableFilter(val: any): void {
    if (this.permissionTable) {
      return this.permissionTable.filterGlobal(val, this.filterMode)
    }
  }
  public onClearTableFilter(): void {
    if (this.permissionTableFilterInput) {
      this.permissionTableFilterInput.nativeElement.value = ''
      this.quickFilterValue = 'ALL'
    }
    this.filterAppValue = undefined
    this.onSortPermissionTable()
    this.permissionTable?.clear()
  }
  public onSortPermissionTable() {
    // reset icons
    if (this.sortIconAppId) this.sortIconAppId.nativeElement.className = 'pi pi-fw pi-sort-alt'
    if (this.sortIconProduct) this.sortIconProduct.nativeElement.className = 'pi pi-fw pi-sort-alt'
  }
  /**
   * Filter: Product, AppId
   */
  public onFilterItemSortIcon(ev: MouseEvent, icon: HTMLSpanElement, field: string) {
    ev.stopPropagation()
    this.permissionTable?.clear()
    switch (icon.className) {
      case 'pi pi-fw pi-sort-amount-down':
        icon.className = 'pi pi-fw pi-sort-amount-up-alt'
        this.permissionTable?._value.sort(
          field === 'appId' ? this.sortPermissionRowByAppIdAsc : this.sortPermissionRowByProductAsc
        )
        break
      case 'pi pi-fw pi-sort-alt': // init
      case 'pi pi-fw pi-sort-amount-up-alt':
        icon.className = 'pi pi-fw pi-sort-amount-down'
        this.permissionTable?._value.sort(
          field === 'appId' ? this.sortPermissionRowByAppIdDesc : this.sortPermissionRowByProductDesc
        )
        break
    }
  }
  public onFilterItemClearAppId() {
    this.filterAppValue = undefined
    this.permissionTable?.filter(this.filterAppValue, 'appId', 'notEquals')
  }

  // if product name selected then reload app id filter
  public onFilterItemChangeProduct(ev: any) {
    this.filterProductValue = ev.value
    this.filterAppValue = undefined
    this.permissionTable?.filter(this.filterAppValue, 'appId', 'notEquals')
    this.permissionTable?.filter(this.filterProductValue, 'productName', 'equals')
    this.prepareFilterApps(this.filterProductValue)
  }

  /****************************************************************************
   *  ROLE
   ****************************************************************************
   */
  public onCreateRole(ev?: MouseEvent): void {
    ev?.stopPropagation()
    this.role = undefined
    this.changeMode = 'CREATE'
    this.showRoleDetailDialog = true
  }
  public onEditRole(ev: MouseEvent, role: Role): void {
    ev.stopPropagation()
    this.role = role
    this.changeMode = 'EDIT'
    this.showRoleDetailDialog = true
  }
  public onDeleteRole(ev: MouseEvent, role: Role): void {
    ev.stopPropagation()
    this.role = role
    this.changeMode = 'DELETE'
    this.showRoleDeleteDialog = true
  }
  public onDetailChanged(changed: boolean) {
    this.role = undefined
    this.permission = undefined
    this.changeMode = 'VIEW'
    this.showPermissionDetailDialog = false
    this.showPermissionDeleteDialog = false
    this.showRoleDetailDialog = false
    this.showRoleDeleteDialog = false
    this.showIamRolesDialog = false
    if (changed) this.loadData()
  }
  public onAddIAMRoles(ev: MouseEvent) {
    this.showIamRolesDialog = true
  }

  /****************************************************************************
   *  PERMISSION
   ****************************************************************************
   */
  public onCopyPermission(ev: MouseEvent, perm: PermissionViewRow): void {
    this.onDetailPermission(ev, { ...perm, operator: false })
    this.changeMode = 'CREATE'
  }
  public onCreatePermission(ev?: MouseEvent): void {
    ev?.stopPropagation()
    this.role = undefined
    this.changeMode = 'CREATE'
    this.showPermissionDetailDialog = true
  }
  public onDetailPermission(ev: MouseEvent, perm: PermissionViewRow): void {
    ev.stopPropagation()
    this.permission = perm
    this.changeMode = this.permission.mandatory ? 'VIEW' : 'EDIT'
    this.showPermissionDetailDialog = true
  }
  public onDeletePermission(ev: MouseEvent, perm: PermissionViewRow): void {
    ev.stopPropagation()
    this.permission = perm
    this.changeMode = 'DELETE'
    this.showPermissionDeleteDialog = true
  }

  /****************************************************************************
   *  ASSIGNMENTS    => grant + revoke permissions => assign roles
   ****************************************************************************
   */
  public onAssignPermission(ev: MouseEvent, permRow: PermissionViewRow, role: Role): void {
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
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
          console.error(err)
        }
      })
  }
  public onRemovePermission(ev: MouseEvent, permRow: PermissionViewRow, role: Role): void {
    this.assApi.deleteAssignment({ id: permRow.roles[role.id!] } as DeleteAssignmentRequestParams).subscribe({
      next: () => {
        this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_SUCCESS' })
        permRow.roles[role.id!] = undefined
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
        console.error(err)
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
  public onGrantAllPermissions(ev: MouseEvent, role: Role): void {
    const response: any = {
      next: () => {
        this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ALL_SUCCESS' })
        this.loadRoleAssignments(false, role.id)
      },
      error: (err: any) => {
        this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
        console.error(err)
      }
    }
    if (this.filterAppValue) {
      this.assApi
        .grantRoleApplicationAssignments({
          roleId: role.id,
          createRoleApplicationAssignmentRequest: {
            appId: this.filterAppValue,
            productName: this.prepareProductListForBulkOperation()[0]
          }
        } as GrantRoleApplicationAssignmentsRequestParams)
        .subscribe(response)
    } else {
      this.assApi
        .grantRoleProductsAssignments({
          roleId: role.id,
          createRoleProductsAssignmentRequest: { productNames: this.prepareProductListForBulkOperation() }
        } as GrantRoleProductsAssignmentsRequestParams)
        .subscribe(response)
    }
  }

  /* REVOKE ALL depends on what ALL means:
     ... see GRANT description above
  */
  public onRevokeAllPermissions(ev: MouseEvent, role: Role): void {
    const response: any = {
      next: () => {
        this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ALL_SUCCESS' })
        this.loadRoleAssignments(false, role.id)
      },
      error: (err: any) => {
        this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
        console.error(err)
      }
    }
    if (this.filterAppValue) {
      this.assApi
        .revokeRoleApplicationAssignments({
          roleId: role.id,
          revokeRoleApplicationAssignmentRequest: {
            appId: this.filterAppValue,
            productName: this.prepareProductListForBulkOperation()[0]
          }
        } as RevokeRoleApplicationAssignmentsRequestParams)
        .subscribe(response)
    } else {
      this.assApi
        .revokeRoleProductsAssignments({
          roleId: role.id,
          revokeRoleProductsAssignmentRequest: { productNames: this.prepareProductListForBulkOperation() }
        } as RevokeRoleProductsAssignmentsRequestParams)
        .subscribe(response)
    }
  }

  private prepareProductListForBulkOperation(): string[] {
    const pList: string[] = []
    // case 1: APP filter value =>
    if (this.filterAppValue) {
      const apps = this.productApps.filter((p) => p.appId === this.filterAppValue)
      apps.length === 1 ? pList.push(apps[0].productName ?? '') : undefined
      // case 2: PRODUCT
    } else if (this.currentApp.isProduct) pList.push(this.currentApp.productName ?? '')
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

  private sortRoleByName(a: Role, b: Role): number {
    return (a.name ? a.name.toUpperCase() : '').localeCompare(b.name ? b.name.toUpperCase() : '')
  }
}
