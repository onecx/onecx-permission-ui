import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core'
import { CommonModule, Location } from '@angular/common'
import { Router, RouterModule } from '@angular/router'
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
import {
  RoleAPIService,
  PermissionAPIService,
  Configuration,
  Permission,
  Role,
  AssignmentAPIService
} from 'src/app/shared/generated'
import { PermissionRowitem } from './models/permissionRowItem'
import { environment } from '../../../environments/environment'
import {
  AngularRemoteComponentsModule,
  BASE_URL,
  RemoteComponentConfig,
  ocxRemoteComponent,
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
export class OneCXUserRolesPermissionsComponent implements OnInit, ocxRemoteComponent {
  public roles: string[] = []
  environment = environment
  public myPermissions = new Array<string>() // permissions of the user

  public permissionItems: Permission[] = []
  public sortedPermissionItems: PermissionRowitem[] = []
  public items: MenuItem[] = []
  private pageSize = 1000
  public cols = [{}]
  public selectedColumns = [{}]
  public selectedTab = 0
  public sortValue = ''
  public visibility = false
  public activeItem: MenuItem | undefined
  public infoMessage: string | undefined
  public errorMessage: string | undefined
  public loadingExceptionKey = ''
  @ViewChild('permissionTable') permissionTable: Table | undefined
  @ViewChild('permissionTableFilterInput') permissionTableFilter: ElementRef | undefined

  constructor(
    @Inject(BASE_URL) private baseUrl: ReplaySubject<string>,
    private readonly router: Router,
    private userService: UserService,
    private msgService: PortalMessageService,
    private readonly roleApi: RoleAPIService,
    private permApi: PermissionAPIService,
    private assgnmtApi: AssignmentAPIService,
    private translateService: TranslateService
  ) {
    this.userService.lang$.subscribe((lang) => this.translateService.use(lang))
    if (userService.hasPermission('ROLES_PERMISSIONS#VIEW')) this.myPermissions.push('ROLES_PERMISSIONS#VIEW')
  }

  ocxInitRemoteComponent(remoteComponentConfig: RemoteComponentConfig) {
    this.baseUrl.next(remoteComponentConfig.baseUrl)
    this.roleApi.configuration = new Configuration({
      basePath: Location.joinWithSlash(remoteComponentConfig.baseUrl, environment.apiPrefix)
    })
    this.permApi.configuration = new Configuration({
      basePath: Location.joinWithSlash(remoteComponentConfig.baseUrl, environment.apiPrefix)
    })
  }

  public ngOnInit(): void {
    this.loadProfileData()
    this.sortValue = 'USER_ROLE_PERMISSIONS.APPLICATION'
    this.cols = [
      { field: 'name', header: 'USER_ROLE_PERMISSIONS.NAME' },
      { field: 'resource', header: 'USER_ROLE_PERMISSIONS.RESOURCE' },
      { field: 'action', header: 'USER_ROLE_PERMISSIONS.ACTION' },
      { field: 'role', header: 'USER_ROLE_PERMISSIONS.ROLE' },
      { field: 'application', header: 'USER_ROLE_PERMISSIONS.APPLICATION' }
    ]
    this.items = [
      { label: 'ROLE_PERMISSIONS.TABS.PERMISSIONS', icon: 'fa-calendar', id: 'tabPerm' },
      { label: 'ROLE_PERMISSIONS.TABS.ROLES', icon: 'fa-bar-chart', id: 'tabRole' }
    ]
    this.activeItem = this.items[0]
    this.selectedColumns = this.cols
  }

  public loadProfileData(): void {
    this.searchPermissions()
    this.searchRoles()
  }

  public createPermissionData(): void {
    const result: PermissionRowitem[] = []
    this.permissionItems.forEach((item) => {
      result.push({
        name: item.description,
        key: undefined,
        resource: item.resource,
        action: item.action,
        role: 'role',
        application: item.appId
      })
    })
    this.sortedPermissionItems = result.sort(this.sortPermissionRowitemByName)
  }

  private searchPermissions(): void {
    const productNames: string[] = []
    this.permApi
      .searchPermissions({
        permissionSearchCriteria: {
          productNames: productNames,
          pageSize: this.pageSize
        }
      })
      .subscribe({
        next: (result) => {
          result.stream?.map((perm: Permission) => {
            this.permissionItems.push(perm)
          })
          this.createPermissionData()
        },
        error: (err) => {
          this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS'
          console.error('searchPermissions():', err)
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

  private sortPermissionRowitemByName(a: PermissionRowitem, b: PermissionRowitem): number {
    return (a.name ? (a.name as string).toUpperCase() : '').localeCompare(
      b.name ? (b.name as string).toUpperCase() : ''
    )
  }

  public applyGlobalFilter($event: Event, primengTable: Table): void {
    primengTable.filterGlobal(($event.target as HTMLInputElement).value, 'contains')
  }

  public refresh(): void {
    if (this.environment.production) {
      // this.userProfileService.getCurrentUserFromBE().subscribe(
      //   () => {
      //     //TODO what is this ?
      //     // ;(this.authService as KeycloakAuthService).userProfile = profileData
      //     // localStorage.setItem('tkit_user_profile', JSON.stringify(profileData))
      //     // ;(this.authService as KeycloakAuthService)['updateUserFromUserProfile'](
      //     //   (this.authService as KeycloakAuthService).userProfile
      //     // )
      //     this.loadProfileData()
      //     this.msgService.info({ summaryKey: 'ROLE_PERMISSIONS.MSG.PERMISSIONS_REFRESH_INFO' })
      //   },
      //   (err: any) => {
      //     this.msgService.error({ summaryKey: 'ROLE_PERMISSIONS.MSG.PERMISSIONS_REFRESH_ERROR' })
      //     console.error(err)
      //   }
      // )
    } else {
      console.error('Cannot refresh in non production mode')
    }
  }

  public close(): void {
    void this.router.navigateByUrl('/')
  }

  public onClearFilterPermissionTable(): void {
    if (this.permissionTableFilter) {
      this.permissionTableFilter.nativeElement.value = ''
    }
    this.permissionTable?.clear()
    this.loadProfileData()
  }
}
