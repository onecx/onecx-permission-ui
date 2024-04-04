import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Location } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { FormGroup, FormControl, Validators } from '@angular/forms'
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
  RevokeAssignmentRequest,
  CreateAssignmentRequestParams,
  CreateProductAssignmentsRequest,
  DeleteAssignmentRequestParams,
  Application,
  ApplicationAPIService,
  AssignmentAPIService,
  PermissionAPIService,
  RoleAPIService,
  WorkspaceAPIService,
  WorkspaceDetails
} from 'src/app/shared/generated'
import { dropDownSortItemsByLabel, limitText } from 'src/app/shared/utils'

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
  public loadingServerIssue = false
  public actions$: Observable<Action[]> | undefined
  // filter row
  public filterBy = ['action', 'resource']
  public filterNot = false
  public filterValue: string | undefined
  public filterMode = FilterMatchMode.CONTAINS || FilterMatchMode.NOT_CONTAINS
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
  public urlParamAppId = ''
  public urlParamAppType = ''
  public currentApp: App = { appId: 'dummy', appType: 'PRODUCT', isProduct: true } as App
  public dateFormat = 'medium'
  public changeMode: ChangeMode = 'VIEW'
  public myPermissions = new Array<string>() // permissions of the user
  // permission filter
  public filterProductItems!: SelectItem[]
  public filterProductValue: string | undefined = undefined
  public filterAppItems: SelectItem[] = new Array<SelectItem>()
  public filterAppValue: string | undefined = undefined
  private productApps: App[] = []

  // permission management
  private permissions$!: Observable<PermissionPageResult>
  public permissions!: Permission[]
  public permissionRows!: PermissionViewRow[]
  public permissionRow: PermissionViewRow | undefined // working row
  public permissionDefaultRoles: RoleAssignments = {} // used initially on row creation
  // role management
  private roles$!: Observable<RolePageResult>
  public roles!: PermissionRole[]
  public role: Role | undefined
  public missingWorkspaceRoles = false
  public formGroupRole: FormGroup
  public showRoleDetailDialog = false
  public showRoleDeleteDialog = false

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
    this.urlParamAppId = this.route.snapshot.paramMap.get('appId') || ''
    this.urlParamAppType = this.route.snapshot.paramMap.get('appType')?.toUpperCase() || ''
    this.dateFormat = this.userService.lang$.getValue() === 'de' ? 'dd.MM.yyyy HH:mm' : 'medium'
    // simplify permission checks
    if (userService.hasPermission('ROLE#EDIT')) this.myPermissions.push('ROLE#EDIT')
    if (userService.hasPermission('ROLE#DELETE')) this.myPermissions.push('ROLE#DELETE')
    if (userService.hasPermission('PERMISSION#GRANT')) this.myPermissions.push('PERMISSION#GRANT')

    this.formGroupRole = new FormGroup({
      id: new FormControl(null),
      name: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      description: new FormControl(null)
    })
    this.filterMode = FilterMatchMode.CONTAINS
    this.quickFilterItems = [
      { label: 'PERMISSION.SEARCH.FILTER.ALL', value: 'ALL' },
      { label: 'PERMISSION.SEARCH.FILTER.DELETE', value: 'DELETE' },
      { label: 'PERMISSION.SEARCH.FILTER.EDIT', value: 'EDIT' },
      { label: 'PERMISSION.SEARCH.FILTER.VIEW', value: 'VIEW' }
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
        'APP.TYPE'
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

  private onClose(): void {
    this.location.back()
  }
  public onReload(): void {
    this.loadData()
  }

  private loadData(): void {
    this.loading = true
    this.loadingServerIssue = false
    this.loadingExceptionKey = ''
    this.currentApp = {
      id: this.urlParamAppId,
      name: this.urlParamAppId,
      appId: this.urlParamAppId,
      appType: this.urlParamAppType,
      isProduct: !(this.urlParamAppType === 'WORKSPACE')
    } as App
    this.productApps = []
    if (this.urlParamAppType === 'WORKSPACE') {
      this.loadWorkspaceDetails()
    } else {
      this.loadProductDetails()
    }
  }
  private loadProductDetails() {
    this.appApi
      .searchApplications({ applicationSearchCriteria: { productName: this.urlParamAppId ?? '' } })
      .pipe(catchError((error) => of(error)))
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.APP'
          console.error('searchApplications() result:', result)
        } else if (result instanceof Object) {
          this.currentApp = { ...result.stream[0], appType: this.urlParamAppType, isProduct: true } as App
          result.stream.map((app: Application) => this.productApps.push(app as App))
          this.prepareActionButtons()
          this.loadRolesAndPermissions()
        } else {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.APP'
          console.error('getApplicationById() => unknown response:', result)
        }
        this.loading = false
      })
  }
  private loadWorkspaceDetails() {
    this.workspaceApi
      .getDetailsByWorkspaceName({ workspaceName: this.currentApp.appId ?? '' })
      .pipe(catchError((error) => of(error)))
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.WORKSPACE'
          console.error('getDetailsByWorkspaceName() result:', result)
        } else if (result instanceof Object) {
          this.currentApp.workspaceDetails = { ...result }
          if (this.currentApp.workspaceDetails?.products && this.currentApp.workspaceDetails?.products.length > 0) {
            this.currentApp.workspaceDetails?.products.map((product) => {
              if (product.mfe)
                product.mfe.map((a) => {
                  this.productApps.push({ appId: a.appId, name: a.appName, productName: product.productName } as App)
                })
              if (product.ms)
                product.ms.map((a) => {
                  this.productApps.push({ appId: a.appId, name: a.appName, productName: product.productName } as App)
                })
            })
          }
          this.prepareActionButtons()
          this.loadRolesAndPermissions()
        } else {
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.WORKSPACE'
          console.error('getDetailsByWorkspaceName() => unknown response:', result)
        }
      })
  }

  /**
   * COLUMNS => Roles, ROWS => Permissions
   */
  private searchRoles(): Observable<Role[]> {
    this.roles$ = this.roleApi.searchRoles({ roleSearchCriteria: {} }).pipe(
      catchError((err) => {
        this.loadingServerIssue = true
        this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.ROLES'
        console.error('searchRoles():', err)
        return of({} as RolePageResult)
      }),
      finalize(() => (this.loading = false))
    )
    return this.roles$.pipe(
      map((result) => {
        return result.stream
          ? result.stream?.map((role) => {
              this.roles.push(role as PermissionRole)
              return role
            })
          : []
      })
    )
  }
  private searchPermissions(): Observable<Permission[]> {
    const productNames: string[] = []
    //let appIds: string | undefined = undefined
    if (this.currentApp.isProduct) {
      productNames.push(this.currentApp.productName ?? '')
      //appIds = this.currentApp.appId
    } else
      this.currentApp.workspaceDetails?.products?.map((p) => {
        productNames.push(p.productName ?? '')
      })
    this.permissions$ = this.permApi
      .searchPermissions({
        permissionSearchCriteria: {
          productNames: productNames,
          //appId: appIds,
          pageSize: this.pageSize
        }
      })
      .pipe(
        catchError((err) => {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS'
          console.error('searchPermissions():', err)
          return of({} as PermissionPageResult)
        })
      )
    return this.permissions$.pipe(
      map((result) => {
        return result.stream
          ? result.stream?.map((permission) => {
              this.permissions.push(permission)
              return permission
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
  private checkWorkspaceRoles() {
    if (this.currentApp.isProduct) return
    if (this.currentApp.workspaceDetails?.workspaceRoles) {
      this.roles.forEach(
        (r) => (r.isWorkspaceRole = this.currentApp.workspaceDetails?.workspaceRoles?.includes(r.name ?? ''))
      )
      this.missingWorkspaceRoles =
        this.roles.filter((r) => r.isWorkspaceRole === true).length !=
        this.currentApp.workspaceDetails?.workspaceRoles.length
    }
  }

  public onCreateIDMRoles(ev: MouseEvent) {
    console.log('TODO: select IDM roles to take over into permissions')
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
    this.filterProductItems.push({ label: '', value: null })
    if (this.currentApp.workspaceDetails?.products) {
      this.currentApp.workspaceDetails?.products.map((product) => {
        this.filterProductItems.push({ label: product.displayName, value: product.productName })
      })
      this.filterProductItems.sort(dropDownSortItemsByLabel)
    }
  }

  private prepareFilterApps() {
    this.filterAppItems = [{ label: '', value: null } as SelectItem] // empty item
    if (this.permissions.length > 0 && this.productApps.length > 0)
      this.permissions.map((p) => {
        // get the app name from product apps - needed for label
        const app = this.productApps.filter((a) => a.productName === p.productName && a.appId === p.appId)
        if (app.length > 0)
          if (
            app.length === 1 &&
            this.filterAppItems.filter((item) => item.label === app[0].name && item.value === app[0].appId).length === 0
          ) {
            this.filterAppItems.push({ label: app[0].name, value: app[0].appId } as SelectItem)
          }
      })
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
    for (const permission of this.permissions) {
      console.log('this.filterProductItems', this.filterProductItems)
      console.log('this.filterAppItems', this.filterAppItems)
      const products = this.filterProductItems.filter((p) => p.value === permission.productName)
      const apps = this.filterAppItems.filter((p) => p.value === permission.appId)
      console.log('products', products)
      console.log('apps', apps)

      this.permissionRows.push({
        ...permission,
        key: permission.resource + '#' + permission.action,
        productDisplayName: this.currentApp.isProduct
          ? permission.productName
          : products.length > 0
          ? products[0].label
          : permission.productName,
        appDisplayName: apps.length > 0 ? apps[0].label : permission.appId,
        roles: {}
      } as PermissionViewRow)
    }
    this.permissionRows.sort(
      this.currentApp.isProduct ? this.sortPermissionRowByAppIdAsc : this.sortPermissionRowByProductAsc
    )
    this.loadRoleAssignments(false)
  }

  private loadRoleAssignments(clear: boolean) {
    const appList: string[] = []
    if (this.productApps.length === 0) {
      console.warn('No apps found - stop loading assignments')
      return
    } else
      this.productApps.map((app) => {
        appList.push(app.appId ?? '')
      })
    if (clear) {
      this.permissionRows.forEach((p) => {
        p.roles = {}
      })
    }
    this.assApi
      .searchAssignments({ assignmentSearchCriteria: { appIds: appList, pageSize: this.pageSize } })
      .pipe(catchError((error) => of(error)))
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.ASSIGNMENTS'
          console.error('searchAssignments() result:', result)
        } else if (result instanceof Object) {
          // result.stream => assignments => roleId, permissionId, appId
          // this.permissionRows => Permission + key, roles
          // Permission (row): id, appId, resource, action
          result.stream?.forEach((assignment: Assignment) => {
            const permissions = this.permissionRows.filter((p) => p.id === assignment.permissionId)
            permissions.map((permission) => {
              permission.roles[assignment.roleId!] = assignment.id
            })
          })
          this.loading = false
        } else {
          this.loadingServerIssue = true
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
      this.filterValue = ev.value === 'OTHERS' ? ['DELETE', 'EDIT', 'VIEW'] : ev.value
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
      case 'pi pi-fw pi-sort-alt': // init
        icon.className = 'pi pi-fw pi-sort-amount-down'
        break
      case 'pi pi-fw pi-sort-amount-down':
        icon.className = 'pi pi-fw pi-sort-amount-up-alt'
        this.permissionTable?._value.sort(
          field === 'appId' ? this.sortPermissionRowByAppIdAsc : this.sortPermissionRowByProductAsc
        )
        break
      case 'pi pi-fw pi-sort-amount-up-alt':
        icon.className = 'pi pi-fw pi-sort-amount-down'
        this.permissionTable?._value.sort(
          field === 'appId' ? this.sortPermissionRowByAppIdDesc : this.sortPermissionRowByProductDesc
        )
        break
    }
  }
  public onFilterItemClearAppId() {
    this.filterAppValue = this.currentApp.appId
    if (this.permissionTable) {
      this.permissionTable?.filter(this.filterAppValue, 'appId', 'notEquals')
    }
  }

  /****************************************************************************
   *  ROLE    => if currentApp is workspace
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
  public onRoleChanged(changed: boolean) {
    this.role = undefined
    this.changeMode = 'VIEW'
    this.showRoleDetailDialog = false
    this.showRoleDeleteDialog = false
    if (changed) this.loadData()
  }

  /****************************************************************************
   *  ASSIGNMENTS    => grant + revoke permissions
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

  // 1. Permission App => the own product (TODO: existing mismatch, due to only one app of the product is displayed)
  // 2. Workspace App  => a) selected product  b) all products
  public onGrantAllPermissions(ev: MouseEvent, role: Role): void {
    const pList = this.prepareProductList()
    if (pList.length === 0) return // products are required
    this.assApi
      .createProductAssignments({
        createProductAssignmentsRequest: { roleId: role.id, productNames: pList } as CreateProductAssignmentsRequest
      })
      .subscribe({
        next: () => {
          this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_SUCCESS' })
          this.loadRoleAssignments(true)
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
          console.error(err)
        }
      })
  }
  public onRevokeAllPermissions(ev: MouseEvent, role: Role): void {
    const pList = this.prepareProductList()
    if (pList.length === 0) return // products are required
    this.assApi
      .revokeAssignments({
        revokeAssignmentRequest: { roleId: role.id, productNames: pList } as RevokeAssignmentRequest
      })
      .subscribe({
        next: () => {
          this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_SUCCESS' })
          this.loadRoleAssignments(true)
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
          console.error(err)
        }
      })
  }

  private prepareProductList(): string[] {
    const pList: string[] = []
    // => case 1
    if (this.currentApp.isProduct) pList.push(this.currentApp.productName ?? '')
    // => case 2
    else if (this.filterProductValue) pList.push(this.filterProductValue)
    else if (this.filterProductItems.length > 1)
      this.filterProductItems.map((p) => {
        if (p.value) pList.push(p.value ?? '') // ignore empty entry
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
  private sortPermissionRowByAppIdDesc(b: PermissionViewRow, a: PermissionViewRow): number {
    return this.sortPermissionRowByAppIdAsc(a, b)
  }
  private sortPermissionRowByProductAsc(a: PermissionViewRow, b: PermissionViewRow): number {
    return (
      (a.productName ? a.productName.toUpperCase() : '').localeCompare(
        b.productName ? b.productName.toUpperCase() : ''
      ) || a.key.localeCompare(b.key)
    )
  }
  private sortPermissionRowByProductDesc(b: PermissionViewRow, a: PermissionViewRow): number {
    return this.sortPermissionRowByProductAsc(a, b)
  }

  private sortRoleByName(a: Role, b: Role): number {
    return (a.name ? a.name.toUpperCase() : '').localeCompare(b.name ? b.name.toUpperCase() : '')
  }
}
