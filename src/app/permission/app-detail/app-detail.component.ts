import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { HttpErrorResponse } from '@angular/common/http'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { Subject, catchError, of, takeUntil } from 'rxjs'
import { TranslateService } from '@ngx-translate/core'
import { FilterMatchMode, SelectItem } from 'primeng/api'
import { Table } from 'primeng/table'

import { Action, Portal, PortalApiService, PortalMessageService, UserService } from '@onecx/portal-integration-angular'
import { sortDropDownItemsByLabel, limitText } from '../shared/utils'

import {
  ApplicationsRestControllerAPIService,
  PermissionAssignmentsRestControllerAPIService,
  PermissionsRestControllerAPIService,
  DeleteRoleFromAppRequestParams,
  RolesRestControllerAPIService,
  CreatePermissionAssignmentRequestParams,
  DeletePermissionAssignmentRequestParams,
  DeletePermissionFromAppRequestParams,
} from '../generated/api/api'
import {
  ApplicationDTO,
  ApplicationSearchCriteria,
  ApplicationType,
  ApplicationTypeDTO1,
  CreatePermissionDTO,
  PermissionUpdateRequestDTO,
  RoleDTO,
  UpdatePermissionDTO,
} from '../generated/model/models'

type RoleAssignments = { [key: string]: boolean }
type PermissionViewRow = {
  id: string
  key: string
  resource?: string
  action?: string
  name?: string
  description?: string
  applicationId: string
  applicationName?: string
  roles: RoleAssignments
}
type ApplicationRoleDTO = RoleDTO & { appId: string; appName: string }
type PermissionApplicationDTO = ApplicationDTO & { isWorkspace: boolean }
type PermissionDisplayScope = 'WORKSPACE' | 'APPS'

@Component({
  templateUrl: './application-detail.component.html',
  styleUrls: ['./application-detail.component.scss'],
})
export class ApplicationDetailComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject()
  private readonly debug = true // to be removed after finalization
  limitText = limitText
  // dialog control
  public loading = true
  public actions: Action[] = []
  public anyServerIssue = false
  public exceptionKey = ''
  public filterBy = ['action', 'resource']
  public filterNot = false
  public filterValue: string | undefined
  public filterMode = FilterMatchMode.CONTAINS || FilterMatchMode.NOT_CONTAINS
  public quickFilterValue: 'ALL' | 'DELETE' | 'EDIT' | 'VIEW' | 'OTHERS' = 'ALL'
  public quickFilterItems: SelectItem[]
  public permissionScopeValue: PermissionDisplayScope = 'WORKSPACE'
  public permissionScopeItems: SelectItem[]
  @ViewChild('permissionTable') permissionTable: Table | undefined
  @ViewChild('permissionTableFilterInput') permissionTableFilterInput: ElementRef | undefined
  @ViewChild('workspaceAppFilter') workspaceAppFilter: ElementRef | undefined
  @ViewChild('appSortIcon') appSortIcon: ElementRef | undefined

  // data
  private portal: Portal | undefined
  public workspaceAppFilterItems: SelectItem[] = new Array<SelectItem>()
  public workspaceAppFilterValue: string | undefined = undefined
  public workspaceAppFilterValueLength = 10
  public currentAppId = ''
  public currentApp: PermissionApplicationDTO | undefined = {
    id: 'dummy',
    isWorkspace: false,
    applicationType: ApplicationTypeDTO1.App,
  } as PermissionApplicationDTO
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
  public roles: ApplicationRoleDTO[] = new Array<ApplicationRoleDTO>()
  public role: ApplicationRoleDTO | undefined // working role
  public showRoleDetailDialog = false
  public showRoleDeleteDialog = false
  public formGroupRole: FormGroup

  constructor(
    private appApi: ApplicationsRestControllerAPIService,
    private permApi: PermissionsRestControllerAPIService,
    private roleApi: RolesRestControllerAPIService,
    private passApi: PermissionAssignmentsRestControllerAPIService,
    private portalApi: PortalApiService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private translate: TranslateService,
    private msgService: PortalMessageService,
    private userService: UserService
  ) {
    this.currentAppId = this.route.snapshot.paramMap.get('id') || ''
    this.dateFormat = this.userService.lang$.getValue() === 'de' ? 'dd.MM.yyyy HH:mm:ss' : 'medium'
    if (userService.hasPermission('ROLE#EDIT')) this.myPermissions.push('ROLE#EDIT')
    if (userService.hasPermission('ROLE#DELETE')) this.myPermissions.push('ROLE#DELETE')
    if (userService.hasPermission('PERMISSION#EDIT')) this.myPermissions.push('PERMISSION#EDIT')
    if (userService.hasPermission('PERMISSION#DELETE')) this.myPermissions.push('PERMISSION#DELETE')

    this.formGroupPermission = new FormGroup({
      appName: new FormControl({ value: null, disabled: true }, [Validators.required]),
      resource: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      action: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      name: new FormControl(null),
      description: new FormControl(null),
    })
    this.formGroupRole = new FormGroup({
      appName: new FormControl({ value: null, disabled: true }, [Validators.required]),
      roleId: new FormControl(null),
      roleName: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      description: new FormControl(null),
    })
    this.filterMode = FilterMatchMode.CONTAINS
    this.quickFilterItems = [
      { label: 'PERMISSION.SEARCH.FILTER.ALL', value: 'ALL' },
      { label: 'PERMISSION.SEARCH.FILTER.DELETE', value: 'DELETE' },
      { label: 'PERMISSION.SEARCH.FILTER.EDIT', value: 'EDIT' },
      { label: 'PERMISSION.SEARCH.FILTER.VIEW', value: 'VIEW' },
      // { label: 'PERMISSION.SEARCH.FILTER.OTHERS', value: 'OTHERS' },
    ]
    this.permissionScopeItems = [
      { label: 'PERMISSION.SEARCH.SCOPE.WORKSPACE', value: 'WORKSPACE' },
      { label: 'PERMISSION.SEARCH.SCOPE.APPS', value: 'APPS' },
    ]
  }

  public ngOnInit(): void {
    this.translate
      .get([
        'ACTIONS.NAVIGATION.BACK',
        'ACTIONS.NAVIGATION.BACK.TOOLTIP',
        'ACTIONS.CREATE.PERMISSION',
        'ACTIONS.CREATE.PERMISSION.TOOLTIP',
        'ACTIONS.CREATE.ROLE',
        'ACTIONS.CREATE.ROLE.TOOLTIP',
        'ACTIONS.DELETE.LABEL',
        'ACTIONS.DELETE.TOOLTIP',
        'APPLICATION.TYPE',
      ])
      .subscribe((data) => {
        this.prepareActionButtons(data)
      })
    this.loadApp()
  }
  public ngOnDestroy(): void {
    this.destroy$.next(undefined)
    this.destroy$.complete()
  }

  public prepareActionButtons(data: any) {
    this.actions = [] // provoke change event
    this.actions.push({
      label: data['ACTIONS.NAVIGATION.BACK'],
      title: data['ACTIONS.NAVIGATION.BACK.TOOLTIP'],
      actionCallback: () => this.onClose(),
      icon: 'pi pi-arrow-left',
      show: 'always',
    })
    if (this.currentApp !== undefined) {
      this.actions.push(
        {
          label: data['ACTIONS.CREATE.PERMISSION'],
          title: data['ACTIONS.CREATE.PERMISSION.TOOLTIP'],
          actionCallback: () => this.onCreatePermission(),
          icon: 'pi pi-plus',
          show: 'asOverflow',
          permission: 'PERMISSION#EDIT',
        },
        {
          label: data['ACTIONS.CREATE.ROLE'],
          title: data['ACTIONS.CREATE.ROLE.TOOLTIP'],
          actionCallback: () => this.onCreateRole(),
          icon: 'pi pi-plus',
          show: 'asOverflow',
          permission: 'ROLE#EDIT',
        },
        {
          label: data['ACTIONS.DELETE.LABEL'],
          title: data['ACTIONS.DELETE.TOOLTIP'].replace(
            '{{TYPE}}',
            data['APPLICATION.TYPE'] + ' ' + this.currentApp.applicationType
          ),
          actionCallback: () => {
            this.showAppDeleteDialog = true
          },
          icon: 'pi pi-trash',
          show: 'asOverflow',
          permission: 'APPLICATION#DELETE',
        }
      )
    }
  }
  private onClose(): void {
    this.location.back()
  }
  public onReload(): void {
    this.loadApp()
  }
  private log(text: string, obj?: object): void {
    if (this.debug) console.log(text, obj)
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
    //this.preparePermissionTable()
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
  public onPermissionScopeChange(ev: any): void {
    this.prepareWorkspaceAppFilter(ev.value)
  }
  public onFilterWorkspaceApps() {
    this.workspaceAppFilterValue = this.currentAppId
    if (this.permissionTable) {
      this.permissionTable?.filter(
        this.workspaceAppFilterValue,
        'applicationId',
        this.permissionScopeValue === 'APPS' ? 'notEquals' : 'equals'
      )
    }
  }
  // managing the displayed scope: workspace or apps
  private prepareWorkspaceAppFilter(val: PermissionDisplayScope): void {
    this.permissionScopeValue = val
    if (this.currentApp?.isWorkspace) {
      if (this.permissionScopeValue === 'APPS') {
        this.workspaceAppFilterItems = this.workspaceAppFilterItems.filter((a) => a.value !== this.currentAppId)
      }
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
  private loadApp(): void {
    this.loading = true
    this.anyServerIssue = false
    this.exceptionKey = ''
    this.appApi
      .getApplicationById({ applicationId: this.currentAppId })
      .pipe(catchError((error) => of(error)))
      .subscribe((app) => {
        if (app instanceof HttpErrorResponse) {
          this.anyServerIssue = true
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + app.status + '.APPLICATION'
          console.error('getApplicationById():', app)
        } else if (app instanceof Object) {
          this.currentApp = { ...app, id: this.currentAppId, isWorkspace: false } as PermissionApplicationDTO
          if (!this.currentApp.applicationType) this.currentApp.applicationType = ApplicationTypeDTO1.App
          this.currentApp.isWorkspace = this.currentApp.applicationType === ApplicationTypeDTO1.Workspace
          this.log('getApplicationById():', this.currentApp)
          this.translate
            .get([
              'ACTIONS.NAVIGATION.BACK',
              'ACTIONS.NAVIGATION.BACK.TOOLTIP',
              'ACTIONS.CREATE.PERMISSION',
              'ACTIONS.CREATE.PERMISSION.TOOLTIP',
              'ACTIONS.CREATE.ROLE',
              'ACTIONS.CREATE.ROLE.TOOLTIP',
              'ACTIONS.DELETE.LABEL',
              'ACTIONS.DELETE.TOOLTIP',
              'APPLICATION.TYPE',
            ])
            .subscribe((data) => {
              this.prepareActionButtons(data)
            })
          this.prepareColumns()
          this.permissionRows = []
          this.preparePermissionTable(this.currentApp)
          this.prepareWorkspaceAppFilter('WORKSPACE')
          if (this.currentApp.isWorkspace) {
            this.loadWorkspace()
          }
        } else {
          this.anyServerIssue = true
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.APPLICATIONS'
          console.error('getApplicationById() => unknown response:', app)
        }
        this.loading = false
      })
  }

  private loadWorkspace(): void {
    this.loading = true
    this.anyServerIssue = false
    this.exceptionKey = ''
    this.portalApi
      .getPortalData(this.currentAppId)
      .pipe(catchError((error) => of(error)))
      .subscribe((portal) => {
        if (portal instanceof HttpErrorResponse) {
          this.anyServerIssue = true
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + portal.status + '.WORKSPACES'
          console.error('getPortalData():', portal)
        } else if (portal instanceof Object) {
          this.portal = portal
          this.log('portal by name:', this.portal)
          this.loadWorkspaceApps() // get permission of reg. MFEs
        } else {
          this.anyServerIssue = true
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.WORKSPACES'
          console.error('getPortal() => unknown response:', portal)
        }
        this.loading = false
      })
  }

  /**
   * If current app is a WORKSPACE then load registered apps...
   */
  private loadWorkspaceApps() {
    if (this.currentApp?.isWorkspace) {
      // Get workspace apps and make distinct drop down for filtering
      const workspaceApps: Array<string> = []
      for (const mfe of this.portal?.microfrontendRegistrations ?? []) {
        if (mfe.appId && !workspaceApps.includes(mfe.appId)) {
          this.workspaceAppFilterItems.push({ label: mfe.appId, value: mfe.appId } as SelectItem)
          this.workspaceAppFilterValueLength =
            mfe.appId.length > this.workspaceAppFilterValueLength
              ? mfe.appId.length
              : this.workspaceAppFilterValueLength
          workspaceApps.push(mfe.appId)
        }
      }
      if (workspaceApps.length > 0) {
        this.workspaceAppFilterItems.sort(sortDropDownItemsByLabel)
        this.workspaceAppFilterItems.unshift({ label: '', value: '' }) // add empty value
        this.workspaceAppFilterValue = ''

        // Get permissions from all workspace apps (we ignore roles/assignments from apps)
        const applications$ = this.appApi
          .getAllApplicationsBySearchCriteria({
            applicationSearchCriteria: {
              applicationType: ApplicationType.App,
              applicationIds: workspaceApps,
            } as ApplicationSearchCriteria,
          })
          .pipe(catchError((error) => of(error)))

        applications$.pipe(takeUntil(this.destroy$)).subscribe((apps) => {
          if (apps instanceof HttpErrorResponse) {
            this.anyServerIssue = true
            this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + apps.status + '.APPLICATIONS'
            console.error('getAllApplications():', apps)
          } else if (apps instanceof Array) {
            apps
              .filter((app) => workspaceApps.includes(app.id))
              .forEach((app) => {
                this.preparePermissionTable(app as PermissionApplicationDTO)
              })
          } else {
            this.anyServerIssue = true
            this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_0.APPLICATIONS'
            console.error('getAllApplications() => unknown response:', apps)
          }
        })
      }
    }
  }

  /**
   * COLUMNS => Roles
   */
  private prepareColumns(): void {
    this.roles = []
    this.permissionDefaultRoles = {}
    this.currentApp?.roles?.forEach((r) => {
      if (r.name) {
        this.roles.push({ ...r, appId: this.currentAppId, appName: this.currentApp?.name } as ApplicationRoleDTO)
        this.permissionDefaultRoles[r.name] = false
      }
    })
    this.roles.sort(this.sortRoleByName)
  }

  /* 1. Prepare rows of the table: permissions of the <application> as Map
   *    key (resource#action):   'PERMISSION#READ'
   *    value: {resource: 'PERMISSION', action: 'READ', key: 'PERMISSION#READ', name: 'View permission matrix'
   */
  private preparePermissionTable(app: PermissionApplicationDTO): void {
    const permissionRows: Map<string, PermissionViewRow> = new Map()
    // Step through ALL app.permissions[]: PermissionDTO and create rows
    app.permissions?.forEach((p) => {
      if (p?.key) {
        if (!permissionRows.get(p.key) && p.id)
          permissionRows.set(p.key, {
            id: p.id,
            key: p.key,
            applicationId: app.id,
            applicationName: app.name,
            roles: {},
            ...p,
          })
      }
    })
    // Fill permission rows with role assignments of the current application
    permissionRows.forEach((row) => {
      this.currentApp?.assignments?.forEach((ra) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        row.roles[ra.role!] = ra.permissionKeys?.includes(row.key) || false
      })
    })
    this.log(app.id + ' - permissions => rows', permissionRows)
    // add permission rows of this app to permission table
    this.permissionRows = this.permissionRows.concat(
      Array.from(permissionRows.values()).sort(this.sortPermissionRowByKey)
    )
    this.loading = false
  }

  /****************************************************************************
   *  SORT
   */
  private sortPermissionRowByKey(a: PermissionViewRow, b: PermissionViewRow): number {
    return (a.key ? (a.key as string).toUpperCase() : '').localeCompare(b.key ? (b.key as string).toUpperCase() : '')
  }
  private sortPermissionRowByAppIdAsc(a: PermissionViewRow, b: PermissionViewRow): number {
    return (a.applicationId ? (a.applicationId as string).toUpperCase() : '').localeCompare(
      b.applicationId ? (b.applicationId as string).toUpperCase() : ''
    )
  }
  private sortPermissionRowByAppIdDesc(b: PermissionViewRow, a: PermissionViewRow): number {
    return (a.applicationId ? (a.applicationId as string).toUpperCase() : '').localeCompare(
      b.applicationId ? (b.applicationId as string).toUpperCase() : ''
    )
  }
  private sortRoleByName(a: ApplicationRoleDTO, b: ApplicationRoleDTO): number {
    return (a.name ? (a.name as string).toUpperCase() : '').localeCompare(
      b.name ? (b.name as string).toUpperCase() : ''
    )
  }

  /****************************************************************************
   * GRANT/REVOKE all permissions to/from ROLE
   */
  public onGrantAllPermissions(ev: MouseEvent, role: ApplicationRoleDTO): void {
    const appIdsForBulkRequest: string[] = []
    if (this.currentApp?.isWorkspace) {
      if (this.workspaceAppFilterValue && this.workspaceAppFilterValue !== '')
        appIdsForBulkRequest.push(this.workspaceAppFilterValue)
      else
        this.workspaceAppFilterItems.forEach((app) => {
          if (app.value !== '') appIdsForBulkRequest.push(app.value)
        })
    } else {
      appIdsForBulkRequest.push(this.currentAppId)
    }
    this.passApi
      .bulkCreatePermissionAssignment({
        roleId: role.id,
        permissionAssignmentBulkRequestDTO: { appIds: appIdsForBulkRequest },
      })
      .subscribe({
        next: (data) => {
          this.permissionRows.forEach((row) => {
            if (data.role && !row.roles[data.role]) {
              row.roles[data.role] = !row.roles[data.role]
            }
          })
          this.msgService.success({ summaryKey: 'PERMISSION.CREATE_ASSIGNMENT_SUCCESS' })
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'PERMISSION.CREATE_ASSIGNMENT_ERROR' })
          console.error(err)
        },
      })
  }
  public onRevokeAllPermissions(ev: MouseEvent, role: ApplicationRoleDTO): void {
    this.passApi.bulkDeletePermissionAssignment({ applicationId: this.currentAppId, roleId: role.id }).subscribe({
      next: () => {
        this.permissionRows.forEach((row) => {
          if (role.name && row.roles[role.name]) {
            row.roles[role.name] = !row.roles[role.name]
          }
        })
        this.msgService.success({ summaryKey: 'PERMISSION.DELETE_ASSIGNMENT_SUCCESS' })
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'PERMISSION.DELETE_ASSIGNMENT_ERROR' })
        console.error(err)
      },
    })
  }

  /****************************************************************************
   * Create a new ASSIGNMENT => PERMISSION to ROLE ()
   */
  public onAssignPermission(
    ev: MouseEvent,
    permRow: PermissionViewRow,
    role: ApplicationRoleDTO,
    silent?: boolean
  ): void {
    this.passApi
      .createPermissionAssignment({
        applicationId: this.currentAppId,
        permissionId: permRow.id,
        roleId: role.id,
      } as CreatePermissionAssignmentRequestParams)
      .subscribe({
        next: () => {
          if (!silent || silent === undefined)
            this.msgService.success({ summaryKey: 'PERMISSION.CREATE_ASSIGNMENT_SUCCESS' })
          if (role.name) permRow.roles[role.name] = !permRow.roles[role.name]
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'PERMISSION.CREATE_ASSIGNMENT_ERROR' })
          console.error(err)
        },
      })
  }

  /**
   * Remove an ASSIGNMENT => PERMISSION from ROLE
   */
  public onRemovePermission(
    ev: MouseEvent,
    permRow: PermissionViewRow,
    role: ApplicationRoleDTO,
    silent?: boolean
  ): void {
    this.passApi
      .deletePermissionAssignment({
        applicationId: this.currentAppId,
        permissionId: permRow.id,
        roleId: role.id,
      } as DeletePermissionAssignmentRequestParams)
      .subscribe({
        next: () => {
          if (!silent || silent === undefined)
            this.msgService.success({ summaryKey: 'PERMISSION.DELETE_ASSIGNMENT_SUCCESS' })
          if (role.name) permRow.roles[role.name] = !permRow.roles[role.name]
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'PERMISSION.DELETE_ASSIGNMENT_ERROR' })
          console.error(err)
        },
      })
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
    this.formGroupPermission.controls['appName'].patchValue(this.currentAppId)
    this.changeMode = 'CREATE'
    this.permissionRow = { key: '' } as PermissionViewRow
    this.showPermissionDetailDialog = true
  }
  /**
   *  View and Edit a PERMISSION
   */
  public onEditPermission(ev: MouseEvent, permRow: PermissionViewRow): void {
    this.formGroupPermission.controls['resource'].patchValue(permRow.resource)
    this.formGroupPermission.controls['action'].patchValue(permRow.action)
    this.formGroupPermission.controls['name'].patchValue(permRow.name)
    this.formGroupPermission.controls['description'].patchValue(permRow.description)
    this.formGroupPermission.controls['appName'].patchValue(permRow.applicationId)
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
    if (this.formGroupPermission.valid) {
      // check existence: on create => key only, on update => a different as the current
      const permNameExists =
        this.permissionRows.filter(
          (pr) =>
            pr.key ===
              this.formGroupPermission.controls['resource'].value +
                '#' +
                this.formGroupPermission.controls['action'].value &&
            (this.changeMode === 'CREATE' ? true : pr.id ? pr.id !== this.permissionRow?.id : true)
        ).length > 0
      if (permNameExists) {
        this.msgService.error({
          summaryKey: 'PERMISSION.' + this.changeMode + '_HEADER',
          detailKey: 'VALIDATION.ERRORS.' + this.changeMode + '_ALREADY_EXISTS',
        })
        return
      }
      if (this.changeMode === 'CREATE') {
        const permission = {
          resource: this.formGroupPermission.controls['resource'].value,
          action: this.formGroupPermission.controls['action'].value,
          name: this.formGroupPermission.controls['name'].value,
          description: this.formGroupPermission.controls['description'].value,
        } as CreatePermissionDTO
        this.permApi
          .createNewPermission({
            applicationId: this.currentAppId,
            createPermissionDTO: permission,
          })
          .subscribe({
            next: (data) => {
              this.msgService.success({ summaryKey: 'ACTIONS.CREATE.MESSAGE.PERMISSION_OK' })
              this.permissionRows.push({
                id: data.id,
                key: data.key,
                resource: data.resource,
                action: data.action,
                name: data.name,
                description: this.formGroupPermission.controls['description'].value,
                applicationId: this.formGroupPermission.controls['appName'].value,
                roles: this.permissionDefaultRoles,
              } as PermissionViewRow)
              this.permissionRows.sort(this.sortPermissionRowByKey)
            },
            error: (err) => {
              this.msgService.error({ summaryKey: 'ACTIONS.CREATE.MESSAGE.PERMISSION_NOK' })
              console.error(err)
            },
          })
      } else if (this.changeMode === 'EDIT' && this.permissionRow?.id) {
        const permission = {
          resource: this.formGroupPermission.controls['resource'].value,
          action: this.formGroupPermission.controls['action'].value,
          name: this.formGroupPermission.controls['name'].value,
          description: this.formGroupPermission.controls['description'].value,
        } as UpdatePermissionDTO
        this.permApi
          .updatePermissionForApp({
            applicationId: this.permissionRow?.applicationId || this.currentAppId,
            permissionId: this.permissionRow?.id,
            permissionUpdateRequestDTO: { updatePermissionDTO: permission } as PermissionUpdateRequestDTO,
          })
          .subscribe({
            next: (data) => {
              this.msgService.success({ summaryKey: 'ACTIONS.EDIT.MESSAGE.PERMISSION_OK' })
              this.permissionRows = this.permissionRows.filter((p) => p.id !== data.permissionDTO.id)
              this.permissionRows.push({
                id: data.permissionDTO.id,
                key: data.permissionDTO.key,
                resource: data.permissionDTO.resource,
                action: data.permissionDTO.action,
                name: data.permissionDTO.name,
                description: data.permissionDTO.description,
                applicationId: this.permissionRow?.applicationId,
                roles: this.permissionRow?.roles,
              } as PermissionViewRow)
              this.permissionRows.sort(this.sortPermissionRowByKey)
            },
            error: (err) => {
              this.msgService.error({ summaryKey: 'ACTIONS.EDIT.MESSAGE.PERMISSION_NOK' })
              console.error(err)
            },
          })
      }
      this.showPermissionDetailDialog = false
    }
  }
  /**
   * Delete a PERMISSION completely (incl. role assignments)
   */
  public onDeletePermission(ev: MouseEvent, permRow: PermissionViewRow): void {
    this.permissionRow = permRow
    this.showPermissionDeleteDialog = true
  }
  public onDeletePermissionExecute() {
    this.showPermissionDeleteDialog = false
    this.permApi
      .deletePermissionFromApp({
        applicationId: this.currentAppId,
        permissionId: this.permissionRow?.id,
      } as DeletePermissionFromAppRequestParams)
      .subscribe({
        next: () => {
          this.msgService.success({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_OK' })
          this.permissionRows = this.permissionRows.filter((p) => p.id !== this.permissionRow?.id)
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_NOK' })
          console.error(err)
        },
      })
  }

  /****************************************************************************
   *  Create a ROLE    only if currentApp is portal
   */
  public onCreateRole(): void {
    this.formGroupRole.reset()
    this.formGroupRole.controls['appName'].patchValue(this.currentAppId)
    this.changeMode = 'CREATE'
    this.role = undefined
    this.showRoleDetailDialog = true
  }
  /**
   *  View and Edit a ROLE
   */
  public onEditRole(ev: MouseEvent, role: ApplicationRoleDTO): void {
    this.formGroupRole.controls['appName'].patchValue(role.appId)
    this.formGroupRole.controls['roleName'].patchValue(role.name)
    this.formGroupRole.controls['description'].patchValue(role.description)
    this.changeMode = 'EDIT'
    this.role = role
    this.showRoleDetailDialog = true
  }
  /**
   * Save a ROLE
   */
  public onSaveRole(): void {
    if (this.formGroupRole.valid) {
      const roleNameExists =
        this.roles.filter(
          (r) =>
            r.name === this.formGroupRole.controls['roleName'].value &&
            (this.changeMode === 'CREATE' ? true : r.id ? r.id !== this.role?.id : true)
        ).length > 0
      if (roleNameExists) {
        this.msgService.error({
          summaryKey: 'ROLE.' + this.changeMode + '_HEADER',
          detailKey: 'VALIDATION.ERRORS.' + this.changeMode + '_ALREADY_EXISTS',
        })
        return
      }
      if (this.changeMode === 'CREATE') {
        const role = {
          name: this.formGroupRole.controls['roleName'].value,
          description: this.formGroupRole.controls['description'].value,
        } as RoleDTO
        this.roleApi
          .createRoleForApp({
            applicationId: this.currentAppId,
            createRoleDTO: role,
          })
          .subscribe({
            next: () => {
              this.msgService.success({ summaryKey: 'ACTIONS.' + this.changeMode + '.MESSAGE.ROLE_OK' })
              this.loadApp()
            },
            error: (err) => {
              this.msgService.error({ summaryKey: 'ACTIONS.' + this.changeMode + '.MESSAGE.ROLE_NOK' })
              console.error(err)
            },
          })
      } else {
        const roleNameChanged = this.formGroupRole.controls['roleName'].value !== this.role?.name
        const role = {
          id: this.role?.id,
          name: this.formGroupRole.controls['roleName'].value,
          description: this.formGroupRole.controls['description'].value,
        } as RoleDTO
        this.roleApi
          .updateRoleForApp({ applicationId: this.currentAppId, roleUpdateRequestDTO: { roleDTO: role } })
          .subscribe({
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
            },
          })
      }
      this.showRoleDetailDialog = false
    }
  }

  /**
   * Delete a ROLE completely (incl. role assignments)
   */
  public onDeleteRole(ev: MouseEvent, role: ApplicationRoleDTO): void {
    this.role = role
    this.showRoleDeleteDialog = true
  }
  public onDeleteRoleExecute() {
    this.roleApi
      .deleteRoleFromApp({ applicationId: this.currentAppId, roleId: this.role?.id } as DeleteRoleFromAppRequestParams)
      .subscribe({
        next: () => {
          this.msgService.success({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_OK' })
          this.loadApp()
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_NOK' })
          console.error(err.error)
        },
      })
    this.showRoleDeleteDialog = false
  }

  /****************************************************************************
   *  Delete an APPLICATION
   */
  public onDeleteApplication() {
    this.appApi.deleteApplication({ applicationId: this.currentAppId }).subscribe({
      next: () => {
        this.showAppDeleteDialog = false
        this.router.navigate(['..'], { relativeTo: this.route })
        this.msgService.success({ summaryKey: 'ACTIONS.DELETE.MESSAGE.APPLICATION_OK' })
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'ACTIONS.DELETE.MESSAGE.APPLICATION_NOK' })
        console.error(err.error)
      },
    })
  }
}
