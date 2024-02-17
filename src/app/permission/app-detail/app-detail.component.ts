import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { Subject, catchError, map, of, Observable } from 'rxjs'
import { TranslateService } from '@ngx-translate/core'
import { FilterMatchMode, SelectItem } from 'primeng/api'
import { Table } from 'primeng/table'

import { Action, PortalMessageService, UserService } from '@onecx/portal-integration-angular'

import {
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
  Permission,
  /*
  PermissionSearchCriteria,
  Assignment,
  AssignmentSearchCriteria,
  AssignmentPageResult,
  CreateAssignmentRequest,  */
  Application,
  // ApplicationSearchCriteria,
  // ApplicationPageResult,
  ApplicationAPIService,
  AssignmentAPIService,
  PermissionAPIService,
  RoleAPIService,
  WorkspaceAPIService
} from 'src/app/shared/generated'
//import { dropDownSortItemsByLabel, limitText } from 'src/app/shared/utils'
import { limitText } from 'src/app/shared/utils'

type App = Application & { isApp: boolean; type: AppType }
type AppType = 'WORKSPACE' | 'APP'
type AppRole = Role & { appId: string }
type RoleAssignments = { [key: string]: boolean }
type PermissionViewRow = Permission & {
  key: string // combined resource and action => resource#action
  roles: RoleAssignments
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
  @ViewChild('workspaceAppFilter') workspaceAppFilter: ElementRef | undefined
  @ViewChild('appSortIcon') appSortIcon: ElementRef | undefined

  // data
  public workspaceAppFilterItems: SelectItem[] = new Array<SelectItem>()
  public workspaceAppFilterValue: string | undefined = undefined
  public workspaceAppFilterValueLength = 10
  public urlParamAppId = ''
  public urlParamAppType = ''
  public currentApp: App = { appId: 'dummy', type: 'APP' } as App
  public dateFormat = 'medium'
  public changeMode = 'CREATE' || 'EDIT'
  // app management
  public showAppDeleteDialog = false
  // permission management
  public permissionRows: PermissionViewRow[] = new Array<PermissionViewRow>()
  public permissionRow: PermissionViewRow | undefined // working row
  public permissionDefaultRoles: RoleAssignments = {} // used initially on row creation
  public myPermissions = new Array<string>() // permissions of the user which is working with apm
  public showPermissionDetailDialog = false
  public showPermissionDeleteDialog = false
  public formGroupPermission: FormGroup
  // role management
  public roles: Role[] = new Array<Role>()
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
    this.urlParamAppType = this.route.snapshot.paramMap.get('type')?.toUpperCase() || ''
    this.dateFormat = this.userService.lang$.getValue() === 'de' ? 'dd.MM.yyyy HH:mm' : 'medium'
    // simplify permission checks
    if (userService.hasPermission('ROLE#EDIT')) this.myPermissions.push('ROLE#EDIT')
    if (userService.hasPermission('ROLE#DELETE')) this.myPermissions.push('ROLE#DELETE')
    if (userService.hasPermission('PERMISSION#EDIT')) this.myPermissions.push('PERMISSION#EDIT')
    if (userService.hasPermission('PERMISSION#DELETE')) this.myPermissions.push('PERMISSION#DELETE')

    this.formGroupPermission = new FormGroup({
      appId: new FormControl({ value: null, disabled: true }, [Validators.required]),
      resource: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      action: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      description: new FormControl(null)
    })
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
      // { label: 'PERMISSION.SEARCH.FILTER.OTHERS', value: 'OTHERS' },
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
        'ACTIONS.DELETE.TOOLTIP',
        'APPLICATION.TYPE'
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
              label: data['ACTIONS.CREATE.PERMISSION'],
              title: data['ACTIONS.CREATE.PERMISSION.TOOLTIP'],
              actionCallback: () => this.onCreatePermission(),
              icon: 'pi pi-plus',
              show: 'asOverflow',
              permission: 'PERMISSION#EDIT'
            },
            {
              label: data['ACTIONS.CREATE.ROLE'],
              title: data['ACTIONS.CREATE.ROLE.TOOLTIP'],
              actionCallback: () => this.onCreateRole(),
              icon: 'pi pi-plus',
              show: 'asOverflow',
              permission: 'ROLE#EDIT',
              conditional: true,
              showCondition: this.currentApp.type === 'WORKSPACE'
            },
            {
              label: data['ACTIONS.DELETE.LABEL'],
              title: data['ACTIONS.DELETE.TOOLTIP'].replace('{{TYPE}}', 'APP'),
              actionCallback: () => {
                this.showAppDeleteDialog = true
              },
              icon: 'pi pi-trash',
              show: 'asOverflow',
              permission: 'APPLICATION#DELETE',
              conditional: true,
              showCondition: this.currentApp.type === 'APP'
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
  private log(text: string, obj?: object): void {
    if (this.debug) {
      if (obj) console.log('app detail: ' + text, obj)
      else console.log('app detail: ' + text)
    }
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
        appId: this.urlParamAppId,
        name: this.urlParamAppId,
        type: this.urlParamAppType
      } as App
      this.log('loadApp => Workspace:', this.currentApp)
      this.prepareActionButtons()
      this.loadRoles()
      this.loading = false
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
            this.currentApp = { ...result.stream[0], type: 'APP' } as App
            this.log('loadApp => App:', this.currentApp)
            this.prepareActionButtons()
            this.permissionRows = []
            this.preparePermissionTable(this.currentApp)
          } else {
            this.loadingServerIssue = true
            this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.APPS'
            console.error('getApplicationById() => unknown response:', result)
          }
          this.loading = false
        })
    }
  }
  /**
   * COLUMNS => Roles
   */
  private loadRoles(): void {
    this.roles = []
    this.permissionDefaultRoles = {}
    this.roleApi
      .searchRoles({ roleSearchCriteria: {} })
      .pipe(catchError((error) => of(error)))
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.ROLES'
          console.error('searchRoles() result:', result)
        } else if (result instanceof Object) {
          for (const role of result.stream) {
            this.roles.push({ ...role })
            this.permissionDefaultRoles[role.name] = false
          }
          this.roles.sort(this.sortRoleByName)
          this.log('loadRoles:', this.roles)
        } else {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.ROLES'
          console.error('searchRoles() => unknown response:', result)
        }
      })
  }

  /* 1. Prepare rows of the table: permissions of the <application> as Map
   *    key (resource#action):   'PERMISSION#READ'
   *    value: {resource: 'PERMISSION', action: 'READ', key: 'PERMISSION#READ', name: 'View permission matrix'
   */
  private preparePermissionTable(app: App): void {
    const permissionRows: Map<string, PermissionViewRow> = new Map()
    // get permissions for the app
    this.permApi
      .searchPermissions({ permissionSearchCriteria: { appId: this.currentApp.appId } })
      .pipe(catchError((error) => of(error)))
      .subscribe((result) => {
        if (result instanceof HttpErrorResponse) {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + result.status + '.PERMISSIONS'
          console.error('searchPermissions() result:', result)
        } else if (result instanceof Object) {
          for (const permission of result.stream) {
            permissionRows.set(permission.resource + '#' + permission.action, {
              ...permission,
              key: permission.resource + '#' + permission.action,
              roles: {}
            })
          }
          this.roles.sort(this.sortRoleByName)
          this.log('loadPermissions:', permissionRows)

          // add permission rows of this app to permission table
          this.permissionRows = this.permissionRows.concat(
            Array.from(permissionRows.values()).sort(this.sortPermissionRowByKey)
          )
          this.loading = false
        } else {
          this.loadingServerIssue = true
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.ROLES'
          console.error('searchPermissions() => unknown response:', result)
        }
      })
    /*
    // Fill permission rows with role assignments of the current application
    permissionRows.forEach((row) => {
      this.currentApp?.assignments?.forEach((ra) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        row.roles[ra.role!] = ra.permissionKeys?.includes(row.key) || false
      })
    })
*/
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
    if (this.appSortIcon) this.appSortIcon.nativeElement.className = 'pi pi-fw pi-sort-alt' // reset icon
  }
  public onWorkspaceAppFilterItemSort(ev: any, icon: HTMLSpanElement) {
    ev.stopPropagation
    icon.className =
      'pi pi-fw ' +
      (icon.className.match('pi-sort-alt')
        ? 'pi-sort-amount-down'
        : icon.className.match('pi-sort-amount-up-alt')
        ? 'pi-sort-amount-down'
        : 'pi-sort-amount-up-alt')
    this.permissionTable?.clear()
    // sort table data directly
    this.permissionTable?._value.sort(
      icon.className.match('pi-sort-amount-up-alt')
        ? this.sortPermissionRowByAppIdAsc
        : this.sortPermissionRowByAppIdDesc
    )
  }
  public onFilterWorkspaceApps() {
    this.workspaceAppFilterValue = this.urlParamAppId
    if (this.permissionTable) {
      this.permissionTable?.filter(this.workspaceAppFilterValue, 'applicationId', 'notEquals')
    }
  }
  // managing the app filter
  private prepareWorkspaceAppFilter(): void {
    if (this.urlParamAppType === 'WORKSPACE') {
      this.workspaceAppFilterItems = this.workspaceAppFilterItems.filter((a) => a.value !== this.urlParamAppId)
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

  /****************************************************************************
   *  1. Load current app
   *  2. Identify app type => use default APP
   *  3. If WORKSPACE then load apps
   */

  /****************************************************************************
   *  Delete an APPLICATION
   */
  public onDeleteApplication() {
    this.log('onDeleteApplication()')
  }

  /****************************************************************************
   * Create a new PERMISSION
   */
  public onCopyPermission(ev: MouseEvent, permRow: PermissionViewRow): void {
    this.onEditPermission(ev, permRow)
    this.changeMode = 'CREATE'
  }
  public onCreatePermission(): void {
    this.formGroupPermission.reset()
    this.formGroupPermission.controls['appId'].patchValue(this.currentApp.appId)
    this.changeMode = 'CREATE'
    this.permissionRow = { key: '' } as PermissionViewRow
    this.showPermissionDetailDialog = true
  }
  /**
   *  View and Edit a PERMISSION
   */
  public onEditPermission(ev: MouseEvent, permRow: PermissionViewRow): void {
    this.formGroupPermission.controls['appId'].patchValue(this.currentApp.appId)
    this.formGroupPermission.controls['resource'].patchValue(permRow.resource)
    this.formGroupPermission.controls['action'].patchValue(permRow.action)
    this.formGroupPermission.controls['description'].patchValue(permRow.description)
    this.changeMode = 'EDIT'
    this.permissionRow = permRow
    this.showPermissionDetailDialog = true
  }
  /**
   * Save a PERMISSION
   *  check existence of (new) key value first to be unique
   */
  public onSavePermission(): void {
    this.log('savePermission ' + this.changeMode + ' valid:' + this.formGroupPermission.valid, this.permissionRow)
  }
  public onDeletePermission(ev: MouseEvent, permRow: PermissionViewRow): void {
    this.permissionRow = permRow
    this.showPermissionDeleteDialog = true
  }
  public onDeletePermissionExecute() {
    this.log('onDeletePermissionExecute()')
  }

  /****************************************************************************
   *  Create a ROLE    only if currentApp is portal
   */
  public onCreateRole(): void {
    this.formGroupRole.reset()
    this.changeMode = 'CREATE'
    this.role = undefined
    this.showRoleDetailDialog = true
  }
  /**
   *  View and Edit a ROLE
   */
  public onEditRole(ev: MouseEvent, role: AppRole): void {
    this.formGroupRole.controls['name'].patchValue(role.name)
    this.formGroupRole.controls['description'].patchValue(role.description)
    this.changeMode = 'EDIT'
    this.role = role
    this.showRoleDetailDialog = true
  }
  /**
   * Save a ROLE
   */
  public onSaveRole(): void {
    this.log('onSaveRole()')
    if (this.formGroupRole.valid) {
      const roleExists =
        this.roles.filter(
          (r) =>
            r.name === this.formGroupRole.controls['name'].value &&
            (this.changeMode === 'CREATE' ? true : r.id ? r.id !== this.role?.id : true)
        ).length > 0
      if (roleExists) {
        this.msgService.error({
          summaryKey: 'ROLE.' + this.changeMode + '_HEADER',
          detailKey: 'VALIDATION.ERRORS.ROLE.' + this.changeMode + '_ALREADY_EXISTS'
        })
        return
      }
      if (this.changeMode === 'CREATE') {
        const role = {
          name: this.formGroupRole.controls['name'].value,
          description: this.formGroupRole.controls['description'].value
        } as CreateRoleRequest
        this.roleApi
          .createRole({
            createRoleRequest: role
          })
          .subscribe({
            next: () => {
              this.msgService.success({ summaryKey: 'ACTIONS.' + this.changeMode + '.MESSAGE.ROLE_OK' })
              this.loadApp()
            },
            error: (err) => {
              this.msgService.error({ summaryKey: 'ACTIONS.' + this.changeMode + '.MESSAGE.ROLE_NOK' })
              console.error(err)
            }
          })
      } else {
        const roleNameChanged = this.formGroupRole.controls['name'].value !== this.role?.name
        const role = {
          modificationCount: this.role?.modificationCount,
          name: this.formGroupRole.controls['name'].value,
          description: this.formGroupRole.controls['description'].value
        } as UpdateRoleRequest
        this.roleApi.updateRole({ id: this.role?.id ?? '', updateRoleRequest: role }).subscribe({
          next: () => {
            this.msgService.success({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_OK' })
            if (roleNameChanged) this.loadApp() // reload all to avoid any mistakes
            else {
              this.roles.forEach((r) => {
                if (r.id === this.role?.id) r.description = role.description
              })
            }
          },
          error: (err) => {
            this.msgService.error({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_NOK' })
            console.error(err)
          }
        })
      }
      this.showRoleDetailDialog = false
    }
  }

  public onDeleteRole(ev: MouseEvent, role: AppRole): void {
    this.role = role
    this.showRoleDeleteDialog = true
  }
  public onDeleteRoleExecute() {
    this.log('onDeleteRoleExecute()')
    this.roleApi.deleteRole({ id: this.role?.id ?? '' }).subscribe({
      next: () => {
        this.msgService.success({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_OK' })
        this.loadApp()
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_NOK' })
        console.error(err.error)
      }
    })
    this.showRoleDeleteDialog = false
  }

  public onAssignPermission(ev: MouseEvent, permRow: PermissionViewRow, role: AppRole, silent?: boolean): void {
    this.log('onAssignPermission()')
  }
  public onRemovePermission(ev: MouseEvent, permRow: PermissionViewRow, role: AppRole, silent?: boolean): void {
    this.log('onRemovePermission()')
  }
  public onGrantAllPermissions(ev: MouseEvent, role: AppRole): void {
    this.log('onGrantAllPermissions()')
  }
  public onRevokeAllPermissions(ev: MouseEvent, role: AppRole): void {
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
  private sortRoleByName(a: Role, b: Role): number {
    return (a.name ? (a.name as string).toUpperCase() : '').localeCompare(
      b.name ? (b.name as string).toUpperCase() : ''
    )
  }
}
