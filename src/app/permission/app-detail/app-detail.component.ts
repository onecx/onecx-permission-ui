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
  //CreateRoleRequest,
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
  isApp: boolean
  isMfe: boolean
  appType: PermissionAppType
  workspaceDetails?: WorkspaceDetails
}
export type PermissionAppType = 'WORKSPACE' | 'APP'
export type ServiceAppType = 'MFE' | 'MS'
export type RoleAssignments = { [key: string]: string | undefined }
export type ChangeMode = 'VIEW' | 'CREATE' | 'EDIT' | 'COPY' | 'DELETE'
export type PermissionViewRow = Permission & {
  key: string // combined resource and action => resource#action
  roles: RoleAssignments // true if assignment exist
  appType: ServiceAppType
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
  public currentApp: App = { appId: 'dummy', appType: 'APP', isApp: true } as App
  public dateFormat = 'medium'
  public changeMode: ChangeMode = 'CREATE' || 'EDIT'
  public myPermissions = new Array<string>() // permissions of the user
  // permission filter
  public filterProductItems!: SelectItem[]
  public filterProductValue: string | undefined = undefined
  public filterAppItems: SelectItem[] = new Array<SelectItem>()
  public filterAppValue: string | undefined = undefined
  private workspaceApps: App[] = []

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
    this.loadApp()
  }
  public ngOnDestroy(): void {
    this.destroy$.next(undefined)
    this.destroy$.complete()
  }
  private log(text: string, obj?: object): void {
    if (this.debug) {
      if (obj) console.log('app detail: ' + text, obj)
      else console.log('app detail: ' + text)
    }
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
              permission: 'ROLE#EDIT',
              conditional: true,
              showCondition: !this.currentApp.isApp
            }
          ]
        })
      )
  }

  private onClose(): void {
    this.location.back()
  }
  public onReload(): void {
    this.loadApp()
  }

  private loadApp(): void {
    this.loading = true
    this.loadingServerIssue = false
    this.loadingExceptionKey = ''
    // on workspace: create a dummy app
    if (this.urlParamAppType === 'WORKSPACE') {
      this.currentApp = {
        id: this.urlParamAppId,
        name: this.urlParamAppId,
        appId: this.urlParamAppId,
        appType: this.urlParamAppType,
        isApp: false,
        isMfe: false
      } as App
      this.log('loadApp => Workspace:', this.currentApp)
      this.loadWorkspaceDetails()
    } else {
      this.appApi
        .searchApplications({ applicationSearchCriteria: { appId: this.urlParamAppId } })
        .pipe(catchError((error) => of(error)))
        .subscribe((result) => {
          if (result instanceof HttpErrorResponse) {
            this.loadingServerIssue = true
            this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.APP'
            console.error('searchApplications() result:', result)
          } else if (result instanceof Object) {
            this.currentApp = { ...result.stream[0], appType: 'APP', isApp: true } as App
            this.log('loadApp => App:', this.currentApp)
            this.loadAppDetails()
          } else {
            this.loadingServerIssue = true
            this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.APP'
            console.error('getApplicationById() => unknown response:', result)
          }
          this.loading = false
        })
    }
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
          this.log('getDetailsByWorkspaceName => App:', this.currentApp)
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
  private declareRoleObservable(): void {
    this.roles$ = this.roleApi.searchRoles({ roleSearchCriteria: {} }).pipe(
      catchError((err) => {
        this.loadingServerIssue = true
        this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.ROLES'
        console.error('searchRoles():', err)
        return of({} as RolePageResult)
      }),
      finalize(() => (this.loading = false))
    )
  }
  private declarePermissionObservable(appIds?: string): void {
    const productNames: string[] = []
    if (this.currentApp.isApp) productNames.push(this.currentApp.productName ?? '')
    else
      this.currentApp.workspaceDetails?.products?.map((p) => {
        productNames.push(p.productName ?? '')
      })
    this.permissions$ = this.permApi
      .searchPermissions({
        permissionSearchCriteria: {
          productNames: productNames,
          appId: appIds,
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
  }
  private searchRoles(): Observable<Role[]> {
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
    this.declareRoleObservable()
    this.declarePermissionObservable()
    this.roles = []
    this.permissions = []
    combineLatest([this.searchRoles(), this.searchPermissions()]).subscribe(
      () => {}, // next
      () => {}, // error
      () => {
        this.log('loadRolesAndPermissions completed')
        this.checkWorkspaceRoles()
        this.log('roles', this.roles)
        this.log('permissions', this.permissions)
        this.prepareFilterProducts()
        this.prepareFilterApps()
        this.preparePermissionTable()
      }
    )
  }
  private checkWorkspaceRoles() {
    if (this.currentApp.workspaceDetails?.workspaceRoles) {
      this.roles.forEach(
        (r) => (r.isWorkspaceRole = this.currentApp.workspaceDetails?.workspaceRoles?.includes(r.name ?? ''))
      )
    }
  }
  public onCreateIDMRoles(ev: MouseEvent) {}
  public onCreateWorkspaceRoles(ev: MouseEvent) {
    ev.stopPropagation
    /*
    let created = false
    this.log('missing roles ' + this.roles.filter((r) => r.isWorkspaceRole === false))
    if (this.currentApp.workspaceDetails?.workspaceRoles) {
      for (let wRole of this.currentApp.workspaceDetails?.workspaceRoles) {
        this.log('check role ' + wRole)
        if (this.roles.filter((r) => r.name === wRole).length === 0) {
          this.roleApi
            .createRole({
              createRolesRequest: { roles: [{ name: wRole } as CreateRoleRequest] }
            })
            .subscribe({
              next: () => {
                this.log('role created: ' + wRole)
                created = true
              }
            })
      }
    }
    }*/
  }

  /**
   * FILTER
   */
  private prepareFilterProducts() {
    if (this.currentApp.isApp) return
    this.filterProductItems = [{ label: '', value: null } as SelectItem]
    if (this.currentApp.workspaceDetails?.products) {
      this.currentApp.workspaceDetails?.products.map((product) => {
        this.filterProductItems.push({ label: product.productName, value: product.productName } as SelectItem)
      })
      this.filterProductItems.sort(dropDownSortItemsByLabel)
    }
    this.log('filterProductItems: ', this.filterProductItems)
  }

  private prepareFilterApps() {
    if (this.currentApp.isApp) return
    // 1. collect apps registered in workspace
    this.workspaceApps = []
    if (this.currentApp.workspaceDetails?.products) {
      this.currentApp.workspaceDetails?.products.map((product) => {
        if (product.mfe)
          product.mfe.map((a) => {
            this.workspaceApps.push({ appId: a.appId, name: a.appName, productName: product.productName } as App)
          })
        if (product.ms)
          product.ms.map((a) => {
            this.workspaceApps.push({ appId: a.appId, name: a.appName, productName: product.productName } as App)
          })
      })
    }
    this.log('this.workspaceApps: ', this.workspaceApps)

    // 2. fill app filter with apps which have permissions
    this.filterAppItems = [{ label: '', value: null } as SelectItem]
    this.permissions.map((p) => {
      // get the app name from workspace apps - needed for label
      const app = this.workspaceApps.filter((a) => a.productName === p.productName && a.appId === p.appId)
      if (
        app.length === 1 &&
        this.filterAppItems.filter((item) => item.label === app[0].name && item.value === app[0].appId).length === 0
      ) {
        this.filterAppItems.push({ label: app[0].name, value: app[0].appId } as SelectItem)
      }
    })
    this.log('filterAppItems: filterAppItems', this.filterAppItems)
  }

  private loadAppDetails() {
    this.permissions = []
    this.declarePermissionObservable(this.currentApp.appId)
    this.searchPermissions().subscribe(
      () => {}, // next
      () => {}, // error
      () => {
        this.prepareActionButtons()
        this.loadRolesAndPermissions()
      }
    )
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
    // go on
    this.permissionRows = []
    for (const permission of this.permissions) {
      this.permissionRows.push({
        ...permission,
        key: permission.resource + '#' + permission.action,
        roles: {}
      } as PermissionViewRow)
    }
    this.permissionRows.sort(this.currentApp.isApp ? this.sortPermissionRowByKey : this.sortPermissionRowByProductAsc)
    this.log('permissionRows:', this.permissionRows)
    this.loadRoleAssignments()
  }

  private loadRoleAssignments() {
    const appList: string[] = []
    if (this.currentApp.isApp) appList.push(this.currentApp.appId ?? '')
    else {
      if (this.workspaceApps.length === 0) {
        console.warn('No workspace apps found - stop processing')
        return
      } else
        this.workspaceApps.map((app) => {
          appList.push(app.appId ?? '')
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
          this.log('loadRoleAssignments permission rows:', this.permissionRows)
          this.loading = false // TODO
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
    if (this.sortIconAppId) this.sortIconAppId.nativeElement.className = 'pi pi-fw pi-sort-alt' // reset icon
    if (this.sortIconProduct) this.sortIconProduct.nativeElement.className = 'pi pi-fw pi-sort-alt' // reset icon
  }
  /**
   * Filter: Product, AppId
   */
  private onFilterItemSortIcon(ev: MouseEvent, icon: HTMLSpanElement) {
    ev.stopPropagation
    icon.className =
      'pi pi-fw ' +
      (icon.className.match('pi-sort-alt')
        ? 'pi-sort-amount-down'
        : icon.className.match('pi-sort-amount-up-alt')
        ? 'pi-sort-amount-down'
        : 'pi-sort-amount-up-alt')
    this.permissionTable?.clear()
  }
  public onFilterItemSortAppId(ev: any, icon: HTMLSpanElement) {
    this.onFilterItemSortIcon(ev, icon)
    this.permissionTable?._value.sort(
      icon.className.match('pi-sort-amount-up-alt')
        ? this.sortPermissionRowByAppIdAsc
        : this.sortPermissionRowByAppIdDesc
    )
  }
  public onFilterItemSortProduct(ev: any, icon: HTMLSpanElement) {
    this.onFilterItemSortIcon(ev, icon)
    this.permissionTable?._value.sort(
      icon.className.match('pi-sort-amount-up-alt')
        ? this.sortPermissionRowByProductAsc
        : this.sortPermissionRowByProductDesc
    )
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
    ev?.stopPropagation
    this.role = undefined
    this.changeMode = 'CREATE'
    this.showRoleDetailDialog = true
  }
  public onEditRole(ev: MouseEvent, role: Role): void {
    ev.stopPropagation
    this.role = role
    this.changeMode = 'EDIT'
    this.showRoleDetailDialog = true
  }
  public onDeleteRole(ev: MouseEvent, role: Role): void {
    ev.stopPropagation
    this.role = role
    this.changeMode = 'DELETE'
    this.showRoleDeleteDialog = true
  }
  public onRoleChanged(changed: boolean) {
    this.role = undefined
    this.changeMode = 'VIEW'
    this.showRoleDetailDialog = false
    this.showRoleDeleteDialog = false
    if (changed) this.loadApp()
  }

  /****************************************************************************
   *  ASSIGNMENTS    => grant + revoke permissions
   ****************************************************************************
   */
  public onAssignPermission(ev: MouseEvent, permRow: PermissionViewRow, role: Role): void {
    this.log('onAssignPermission()')
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
    this.log('onRemovePermission()')
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
  private prepareProductList(): string[] {
    const pList: string[] = []
    // => case 1
    if (this.currentApp.isApp) pList.push(this.currentApp.productName ?? '')
    else {
      // => case 2
      if (this.filterProductValue) pList.push(this.filterProductValue)
      else if (this.filterProductItems.length > 1)
        this.filterProductItems.map((p) => {
          if (p.value) pList.push(p.value ?? '') // ignore empty entry
        })
    }
    return pList
  }
  // 1. Permission App => the own product
  // 2. Workspace App  => a) selected product  b) all products
  public onGrantAllPermissions(ev: MouseEvent, role: Role): void {
    this.log('onGrantAllPermissions()')
    const pList = this.prepareProductList()
    if (pList.length === 0) return // products are required
    this.assApi
      .createProductAssignments({
        createProductAssignmentsRequest: { roleId: role.id, productNames: pList } as CreateProductAssignmentsRequest
      })
      .subscribe({
        next: () => {
          this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_SUCCESS' })
          this.loadRolesAndPermissions()
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
          console.error(err)
        }
      })
  }
  public onRevokeAllPermissions(ev: MouseEvent, role: Role): void {
    this.log('onRevokeAllPermissions()')
    const pList = this.prepareProductList()
    if (pList.length === 0) return // products are required
    this.assApi
      .revokeAssignments({
        revokeAssignmentRequest: { roleId: role.id, productNames: pList } as RevokeAssignmentRequest
      })
      .subscribe({
        next: () => {
          this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_SUCCESS' })
          this.loadRolesAndPermissions()
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
          console.error(err)
        }
      })
  }

  /****************************************************************************
   *  SORT
   */
  private sortPermissionRowByKey(a: PermissionViewRow, b: PermissionViewRow): number {
    return (a.key ? (a.key as string).toUpperCase() : '').localeCompare(b.key ? (b.key as string).toUpperCase() : '')
  }

  private sortPermissionRowByAppIdAsc(a: PermissionViewRow, b: PermissionViewRow): number {
    return (a.appId ? (a.appId as string).toUpperCase() : '').localeCompare(
      b.appId ? (b.appId as string).toUpperCase() : ''
    )
  }
  private sortPermissionRowByAppIdDesc(b: PermissionViewRow, a: PermissionViewRow): number {
    return (a.appId ? (a.appId as string).toUpperCase() : '').localeCompare(
      b.appId ? (b.appId as string).toUpperCase() : ''
    )
  }
  private sortPermissionRowByProductAsc(a: PermissionViewRow, b: PermissionViewRow): number {
    return (a.productName ? (a.productName as string).toUpperCase() : '').localeCompare(
      b.productName ? (b.productName as string).toUpperCase() : ''
    )
  }
  private sortPermissionRowByProductDesc(b: PermissionViewRow, a: PermissionViewRow): number {
    return (a.productName ? (a.productName as string).toUpperCase() : '').localeCompare(
      b.productName ? (b.productName as string).toUpperCase() : ''
    )
  }

  private sortRoleByName(a: Role, b: Role): number {
    return (a.name ? (a.name as string).toUpperCase() : '').localeCompare(
      b.name ? (b.name as string).toUpperCase() : ''
    )
  }
}
