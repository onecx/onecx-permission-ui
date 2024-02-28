import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { Subject, catchError, combineLatest, finalize, map, of, Observable, startWith } from 'rxjs'
import { TranslateService } from '@ngx-translate/core'
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
  DeleteAssignmentRequestParams,
  /*
  AssignmentSearchCriteria,
  AssignmentPageResult,
  CreateAssignmentRequest,  */
  Application,
  Product,
  ApplicationAPIService,
  AssignmentAPIService,
  PermissionAPIService,
  RoleAPIService,
  WorkspaceAPIService,
  WorkspaceDetails
} from 'src/app/shared/generated'
//import { dropDownSortItemsByLabel, limitText } from 'src/app/shared/utils'
import { limitText } from 'src/app/shared/utils'

export type App = Application & {
  isApp: boolean
  isMfe: boolean
  appType: PermissionAppType
  workspaceDetails?: WorkspaceDetails
}
export type PermissionAppType = 'WORKSPACE' | 'APP'
export type ServiceAppType = 'MFE' | 'MS'
export type RoleAssignments = { [key: string]: boolean }
export type ChangeMode = 'VIEW' | 'CREATE' | 'EDIT' | 'COPY' | 'DELETE'
export type PermissionViewRow = Permission & {
  key: string // combined resource and action => resource#action
  roles: RoleAssignments
  appType: ServiceAppType
}

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
  public filterBy = ['action', 'resource']
  public filterNot = false
  public filterValue: string | undefined
  public filterMode = FilterMatchMode.CONTAINS || FilterMatchMode.NOT_CONTAINS
  public quickFilterValue: 'ALL' | 'DELETE' | 'EDIT' | 'VIEW' | 'OTHERS' = 'ALL'
  public quickFilterItems: SelectItem[]

  @ViewChild('permissionTable') permissionTable: Table | undefined
  @ViewChild('permissionTableFilterInput') permissionTableFilterInput: ElementRef | undefined
  @ViewChild('workspaceProductFilter') workspaceProductFilter: ElementRef | undefined
  @ViewChild('workspaceAppTypeFilter') workspaceAppTypeFilter: ElementRef | undefined
  @ViewChild('workspaceAppFilter') workspaceAppFilter: ElementRef | undefined
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

  private workspaceProducts: Product[] = []
  public workspaceProductFilterItems: SelectItem[] = new Array<SelectItem>()
  public workspaceProductFilterValue: string | undefined = undefined

  public workspaceAppTypeFilterItems: SelectItem[] = new Array<SelectItem>()
  public workspaceAppTypeFilterValue: string | undefined = undefined

  private workspaceApps: App[] = []
  public workspaceAppFilterItems: SelectItem[] = new Array<SelectItem>()
  public workspaceAppFilterValue: string | undefined = undefined
  public workspaceAppFilterValueLength = 10
  // app management
  public showAppDeleteDialog = false
  // permission management
  private permissions$!: Observable<PermissionPageResult>
  public permissions!: Permission[]
  public permissionRows!: PermissionViewRow[]
  public permissionRow: PermissionViewRow | undefined // working row
  public permissionDefaultRoles: RoleAssignments = {} // used initially on row creation
  // role management
  private roles$!: Observable<RolePageResult>
  public roles!: Role[]
  public role: Role | undefined
  public showRoleDetailDialog = false
  public showRoleDeleteDialog = false
  public formGroupRole: FormGroup

  constructor(
    private appApi: ApplicationAPIService,
    private assApi: AssignmentAPIService,
    private permApi: PermissionAPIService,
    private roleApi: RoleAPIService,
    private workspaceApi: WorkspaceAPIService,
    private route: ActivatedRoute,
    private router: Router,
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
    this.workspaceAppTypeFilterItems = [
      { label: '', value: null },
      { label: 'MFE', value: 'MFE' },
      { label: 'MS', value: 'MS' }
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
    // check parameter
    if (!this.urlParamAppId || this.urlParamAppId === '') {
      this.msgService.error({ summaryKey: 'TODO_MISSING_URL_PARAMETER_APP_ID' })
      return
    }
    if (!this.urlParamAppType || !',APP,WORKSPACE,'.includes(this.urlParamAppType)) {
      this.msgService.error({ summaryKey: 'TODO_MISSING_URL_PARAMETER_APP_TYPE' })
      return
    }
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
      this.prepareActionButtons()
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
            this.prepareActionButtons()
            this.loadAppDetails()
            //this.preparePermissionTable(this.currentApp)
          } else {
            this.loadingServerIssue = true
            this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.APPS'
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
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.APP'
          console.error('getDetailsByWorkspaceName() result:', result)
        } else if (result instanceof Object) {
          this.currentApp.workspaceDetails = { ...result }
          this.log('getDetailsByWorkspaceName => App:', this.currentApp)
          this.prepareWorkspaceApps()
          this.loadRolesAndPermissions()
        } else {
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.APPS'
          console.error('getDetailsByWorkspaceName() => unknown response:', result)
        }
      })
  }
  private prepareWorkspaceApps() {
    this.workspaceApps = []
    this.workspaceProductFilterItems = [{ label: '', value: null } as SelectItem]
    this.workspaceAppFilterItems = [{ label: '', value: null } as SelectItem]
    if (this.currentApp.workspaceDetails?.products) {
      this.currentApp.workspaceDetails?.products.map((product) => {
        this.workspaceProductFilterItems.push({ label: product.productName, value: product.productName } as SelectItem)
        if (product.mfe) {
          product.mfe.map((app) => {
            this.workspaceApps.push({ ...app, appType: 'APP', isApp: true, isMfe: true } as App)
            this.workspaceAppFilterItems.push({ label: app.appName, value: app.appId } as SelectItem)
          })
        }
        if (product.ms) {
          product.ms.map((app) => {
            this.workspaceApps.push({ ...app, appType: 'APP', isApp: true, isMfe: false } as App)
            this.workspaceAppFilterItems.push({ label: app.appName, value: app.appId } as SelectItem)
          })
        }
      })
    }
    this.log('workspaceApps: ', this.workspaceApps)
  }
  /**
   * COLUMNS => Roles, ROWS => Permissions
   */
  private declareRoleObservable(): void {
    this.roles$ = this.roleApi.searchRoles({ roleSearchCriteria: {} }).pipe(
      startWith({} as RolePageResult),
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
    this.permissions$ = this.permApi
      .searchPermissions({ permissionSearchCriteria: { appId: appIds, pageSize: this.pageSize } })
      .pipe(
        startWith({} as PermissionPageResult),
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
              this.roles.push(role)
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
        this.log('roles', this.roles)
        this.log('permissions', this.permissions)
        //this.prepareRoles()
        this.preparePermissionTable()
      }
    )
  }
  private prepareRoles() {
    if (this.currentApp.workspaceDetails?.workspaceRoles) {
      let created = false
      for (let wRole of this.currentApp.workspaceDetails?.workspaceRoles) {
        this.log('check role ' + wRole)
        if (this.roles.filter((r) => r.name === wRole).length === 0) {
          this.roleApi
            .createRole({
              createRoleRequest: { name: wRole } as CreateRoleRequest
            })
            .subscribe({
              next: () => {
                this.log('role created: ' + wRole)
                created = true
              }
            })
        }
      }
      if (created) this.loadRolesAndPermissions()
      else {
        this.roles.sort(this.sortRoleByName)
        this.log('prepareRoles this.roles', this.roles)
      }
    }
  }

  private loadAppDetails() {
    this.permissions = []
    this.declarePermissionObservable(this.currentApp.appId)
    this.searchPermissions().subscribe(
      () => {}, // next
      () => {}, // error
      () => {
        this.preparePermissionTable() // on complete
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
    this.log('permissionRows:', this.permissionRows)
    // proceed only on workspaces
    if (!this.currentApp.isApp) {
      const permissionRows: Map<string, PermissionViewRow> = new Map()
      for (const permissionRow of this.permissionRows) {
        permissionRows.set(permissionRow.resource + '#' + permissionRow.action, permissionRow)
      }
      this.loadAssignments()
    }
  }
  private loadAssignments() {
    if (this.workspaceApps.length === 0) {
      console.warn('No workspace apps found - stop processing')
      return
    }
    const appList = this.workspaceApps.map((app) => app.appId ?? '')
    this.assApi
      .searchAssignments({ assignmentSearchCriteria: { appIds: appList, pageSize: this.pageSize } })
      .pipe(catchError((error) => of(error)))
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.PERMISSIONS'
          console.error('searchAssignments() result:', result)
        } else if (result instanceof Object) {
          this.log('loadAssignments result.stream:', result.stream)
          // result.stream => assignments => roleId, permissionId, appId
          // this.permissionRows => Permission + key, roles
          // Permission (row): id, appId, resource, action
          this.permissionRows.forEach((permission) => {
            this.log('loadAssignments row.id:' + permission.id)
            result.stream?.forEach((assignment: Assignment) => {
              if (assignment.permissionId === permission.id) {
                permission.roles[assignment.roleId!] = assignment.permissionId === permission.id
                this.log('loadAssignments assignment.permissionId:' + assignment.permissionId)
                this.log('loadAssignments assignment.roleId:' + assignment.roleId)
                this.log('loadAssignments row.roles[assignment.roleId!]:' + permission.roles[assignment.roleId!])
              }
            })
          })
          this.log('loadAssignments permission rows:', this.permissionRows)
          //this.prepareWorkspaceAppFilter()
          this.loading = false // TODO
        } else {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.ROLES'
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
    this.workspaceAppFilterValue = undefined
    this.onSortPermissionTable()
    this.permissionTable?.clear()
  }
  public onSortPermissionTable() {
    if (this.sortIconAppId) this.sortIconAppId.nativeElement.className = 'pi pi-fw pi-sort-alt' // reset icon
    if (this.sortIconProduct) this.sortIconProduct.nativeElement.className = 'pi pi-fw pi-sort-alt' // reset icon
  }
  private onFilterItemSortIcon(ev: any, icon: HTMLSpanElement) {
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
  public onFilterWorkspaceApps() {
    this.workspaceAppFilterValue = this.currentApp.appId
    if (this.permissionTable) {
      this.permissionTable?.filter(this.workspaceAppFilterValue, 'appId', 'notEquals')
    }
  }
  // managing the app filter
  private prepareWorkspaceAppFilter(): void {
    if (!this.currentApp.isApp) {
      this.workspaceAppFilterItems = this.workspaceAppFilterItems.filter((a) => a.value !== this.currentApp.appId)
      this.onFilterWorkspaceApps()
    } else {
      this.workspaceAppFilterValue = undefined
      this.workspaceAppFilterValueLength = 10
    }
    if (this.workspaceAppFilter)
      this.workspaceAppFilter.nativeElement.className =
        'p-float-label inline-block w-' +
        (this.workspaceAppFilterValueLength <= 10
          ? 10
          : this.workspaceAppFilterValueLength <= 20
          ? this.workspaceAppFilterValueLength
          : 22) +
        'rem'
  }
  public onFilterWorkspaceAppTypes() {
    this.workspaceAppTypeFilterValue = this.currentApp.appId
    if (this.permissionTable) {
      this.permissionTable?.filter(this.workspaceAppFilterValue, 'appId', 'notEquals')
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
  public onAssignPermission(ev: MouseEvent, permRow: PermissionViewRow, role: Role, silent?: boolean): void {
    this.log('onAssignPermission()')
    this.assApi
      .createAssignment({
        createAssignmentRequest: {
          roleId: role.id,
          permissionId: permRow.id
        }
      } as CreateAssignmentRequestParams)
      .subscribe({
        next: () => {
          if (!silent || silent === undefined)
            this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_SUCCESS' })
          if (role.id) permRow.roles[role.id] = !permRow.roles[role.id]
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.GRANT_ERROR' })
          console.error(err)
        }
      })
  }
  public onRemovePermission(ev: MouseEvent, permRow: PermissionViewRow, role: Role, silent?: boolean): void {
    this.log('onRemovePermission()')
    this.assApi.deleteAssignment({ id: permRow.id } as DeleteAssignmentRequestParams).subscribe({
      next: () => {
        if (!silent || silent === undefined)
          this.msgService.success({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_SUCCESS' })
        if (role.id) permRow.roles[role.id] = !permRow.roles[role.id]
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'PERMISSION.ASSIGNMENTS.REVOKE_ERROR' })
        console.error(err)
      }
    })
  }
  public onGrantAllPermissions(ev: MouseEvent, role: Role): void {
    this.log('onGrantAllPermissions()')
  }
  public onRevokeAllPermissions(ev: MouseEvent, role: Role): void {
    this.log('onRevokeAllPermissions()')
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
    return (
      (a.productName ? (a.productName as string).toUpperCase() : '').localeCompare(
        b.productName ? (b.productName as string).toUpperCase() : ''
      ) || this.sortPermissionRowByAppIdAsc(a, b)
    )
  }
  private sortPermissionRowByProductDesc(b: PermissionViewRow, a: PermissionViewRow): number {
    return (
      (a.productName ? (a.productName as string).toUpperCase() : '').localeCompare(
        b.productName ? (b.productName as string).toUpperCase() : ''
      ) || this.sortPermissionRowByAppIdDesc(a, b)
    )
  }

  private sortRoleByName(a: Role, b: Role): number {
    return (a.name ? (a.name as string).toUpperCase() : '').localeCompare(
      b.name ? (b.name as string).toUpperCase() : ''
    )
  }
}
