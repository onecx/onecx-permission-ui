import { Component, ElementRef, Inject, Input, OnInit, ViewChild } from '@angular/core'
import { CommonModule, Location } from '@angular/common'
import { RouterModule } from '@angular/router'
import { MenuItem } from 'primeng/api'
import { Table } from 'primeng/table'
import { ReplaySubject } from 'rxjs'
import { HttpClient } from '@angular/common/http'
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core'

import { SharedModule } from 'src/app/shared/shared.module'
import {
  PortalCoreModule,
  PortalMessageService,
  UserService,
  createRemoteComponentTranslateLoader
} from '@onecx/portal-integration-angular'
import { Configuration, RoleAPIService, Role, UserAPIService, UserAssignment } from 'src/app/shared/generated'
import { environment } from 'src/environments/environment'
import {
  AngularRemoteComponentsModule,
  BASE_URL,
  RemoteComponentConfig,
  ocxRemoteComponent,
  ocxRemoteWebcomponent,
  provideTranslateServiceForRoot
} from '@onecx/angular-remote-components'

@Component({
  selector: 'app-user-roles-permissions',
  templateUrl: './user-roles-permissions.component.html',
  styleUrls: ['./user-roles-permissions.component.scss'],
  standalone: true,
  imports: [AngularRemoteComponentsModule, CommonModule, PortalCoreModule, RouterModule, TranslateModule, SharedModule],
  providers: [
    PortalMessageService,
    {
      provide: BASE_URL,
      useValue: new ReplaySubject<string>(1)
    },
    provideTranslateServiceForRoot({
      isolate: true,
      loader: {
        provide: TranslateLoader,
        useFactory: createRemoteComponentTranslateLoader,
        deps: [HttpClient, BASE_URL]
      }
    })
  ]
})
export class OneCXUserRolesPermissionsComponent implements OnInit, ocxRemoteComponent, ocxRemoteWebcomponent {
  public roles: string[] = []
  environment = environment
  public myPermissions = new Array<string>() // permissions of the user

  public userAssignmentItems: UserAssignment[] = []
  public items: MenuItem[] = []
  public cols = [{}]
  public selectedColumns = [{}]
  public selectedTab = 0
  public sortValue = ''
  public visibility = false
  public activeItem: MenuItem | undefined
  public infoMessage: string | undefined
  public errorMessage: string | undefined
  public loadingExceptionKey = ''
  @ViewChild('userAssignmentTable') userAssignmentTable: Table | undefined
  @ViewChild('userAssignmentTableFilterInput') userAssignmentTableFilter: ElementRef | undefined

  constructor(
    @Inject(BASE_URL) private baseUrl: ReplaySubject<string>,
    private userService: UserService,
    private msgService: PortalMessageService,
    private readonly roleApi: RoleAPIService,
    private userApi: UserAPIService,
    private translateService: TranslateService
  ) {
    this.userService.lang$.subscribe((lang) => this.translateService.use(lang))
    if (userService.hasPermission('ROLES_PERMISSIONS#VIEW')) this.myPermissions.push('ROLES_PERMISSIONS#VIEW')
  }

  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config)
  }

  ocxInitRemoteComponent(remoteComponentConfig: RemoteComponentConfig) {
    this.baseUrl.next(remoteComponentConfig.baseUrl)
    this.roleApi.configuration = new Configuration({
      basePath: Location.joinWithSlash(remoteComponentConfig.baseUrl, environment.apiPrefix)
    })
    this.userApi.configuration = new Configuration({
      basePath: Location.joinWithSlash(remoteComponentConfig.baseUrl, environment.apiPrefix)
    })
  }

  public ngOnInit(): void {
    this.sortValue = 'USER_ROLE_PERMISSIONS.APPLICATION'
    this.cols = [
      { field: 'resource', header: 'USER_ROLE_PERMISSIONS.RESOURCE' },
      { field: 'action', header: 'USER_ROLE_PERMISSIONS.ACTION' },
      { field: 'productName', header: 'USER_ROLE_PERMISSIONS.APPLICATION' },
      { field: 'roleName', header: 'USER_ROLE_PERMISSIONS.ROLE' }
    ]
    this.items = [
      { label: 'USER_ROLE_PERMISSIONS.TABS.PERMISSIONS', icon: 'fa-calendar', id: 'tabPerm' },
      { label: 'USER_ROLE_PERMISSIONS.TABS.ROLES', icon: 'fa-bar-chart', id: 'tabRole' }
    ]
    this.activeItem = this.items[0]
    this.selectedColumns = this.cols
    this.loadData()
  }

  public loadData(): void {
    this.searchUserAssignments()
    this.searchRoles()
  }

  public createAssignmentData(): void {
    const result: UserAssignment[] = []
    this.userAssignmentItems.forEach((item) => {
      result.push({
        productName: item.productName,
        resource: item.resource,
        action: item.action,
        roleName: item.roleName,
        applicationId: item.applicationId
      })
    })
    result.sort(this.sortUserAssignments)
    this.userAssignmentItems = result
  }

  private searchUserAssignments(): void {
    this.userApi.getUserAssignments({ userCriteria: {} }).subscribe({
      next: (result) => {
        result.stream?.map((assgmt: UserAssignment) => {
          this.userAssignmentItems.push(assgmt)
        })
        this.createAssignmentData()
      },
      error: (err) => {
        this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.ASSIGNMENTS'
        console.error('searchAssignments():', err)
      }
    })
  }
  private searchRoles(): void {
    this.roleApi.searchRoles({ roleSearchCriteria: {} }).subscribe({
      next: (result) => {
        result.stream?.map((role: Role) => {
          this.roles.push(role.name ?? '')
        })
      },
      error: (err) => {
        this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.ROLES'
        console.error('searchRoles():', err)
      }
    })
  }

  private sortUserAssignments(a: UserAssignment, b: UserAssignment): number {
    return (
      (a.productName ? a.productName.toUpperCase() : '').localeCompare(
        b.productName ? b.productName.toUpperCase() : ''
      ) ||
      (a.resource ? a.resource.toUpperCase() : '').localeCompare(b.resource ? b.resource.toUpperCase() : '') ||
      (a.action ? a.action.toUpperCase() : '').localeCompare(b.action ? b.action.toUpperCase() : '')
    )
  }

  public applyGlobalFilter($event: Event, primengTable: Table): void {
    primengTable.filterGlobal(($event.target as HTMLInputElement).value, 'contains')
  }

  public onClearFilterUserAssignmentTable(): void {
    if (this.userAssignmentTableFilter) {
      this.userAssignmentTableFilter.nativeElement.value = ''
    }
    this.userAssignmentTable?.clear()
    this.loadData()
  }

  public onReload() {
    this.userAssignmentItems = []
    this.roles = []
    this.loadData()
  }
}
