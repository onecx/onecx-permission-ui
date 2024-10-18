import { Component, ElementRef, Inject, Input, OnInit, ViewChild } from '@angular/core'
import { CommonModule, Location } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { RouterModule } from '@angular/router'
import { Table } from 'primeng/table'
import { ReplaySubject } from 'rxjs'
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core'

import { SharedModule } from 'src/app/shared/shared.module'
import { PortalCoreModule, UserService, createRemoteComponentTranslateLoader } from '@onecx/portal-integration-angular'
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
  public environment = environment
  public userAssignmentItems: UserAssignment[] = []
  public columns
  public sortValue = ''
  public loadingExceptionKey = ''
  @ViewChild('permissionTable') permissionTable: Table | undefined
  @ViewChild('permissionTableFilterInput') permissionTableFilter: ElementRef | undefined

  constructor(
    @Inject(BASE_URL) private baseUrl: ReplaySubject<string>,
    private userService: UserService,
    private readonly roleApi: RoleAPIService,
    private userApi: UserAPIService,
    private translateService: TranslateService
  ) {
    this.userService.lang$.subscribe((lang) => this.translateService.use(lang))
    this.columns = [
      {
        field: 'resource',
        header: 'USER_ROLE_PERMISSIONS.RESOURCE',
        tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.RESOURCE'
      },
      { field: 'action', header: 'USER_ROLE_PERMISSIONS.ACTION', tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.ACTION' },
      {
        field: 'productName',
        header: 'USER_ROLE_PERMISSIONS.APPLICATION',
        tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.APPLICATION'
      },
      { field: 'roleName', header: 'USER_ROLE_PERMISSIONS.ROLE', tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.ROLE' }
    ]
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
    if (this.permissionTableFilter) {
      this.permissionTableFilter.nativeElement.value = ''
    }
    this.permissionTable?.clear()
    this.loadData()
  }

  public onReload() {
    this.userAssignmentItems = []
    this.roles = []
    this.loadData()
  }
}
