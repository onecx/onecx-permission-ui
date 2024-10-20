import { Component, ElementRef, Inject, Input, OnInit, ViewChild } from '@angular/core'
import { CommonModule, Location } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { RouterModule } from '@angular/router'
import { Table } from 'primeng/table'
import { catchError, finalize, map, Observable, of, ReplaySubject } from 'rxjs'
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core'

import { PortalCoreModule, UserService, createRemoteComponentTranslateLoader } from '@onecx/portal-integration-angular'
import {
  AngularRemoteComponentsModule,
  BASE_URL,
  RemoteComponentConfig,
  ocxRemoteComponent,
  ocxRemoteWebcomponent,
  provideTranslateServiceForRoot
} from '@onecx/angular-remote-components'

import { Configuration, UserAPIService, UserAssignment, UserAssignmentPageResult } from 'src/app/shared/generated'
import { SharedModule } from 'src/app/shared/shared.module'
import { sortByLocale } from 'src/app/shared/utils'
import { environment } from 'src/environments/environment'

// properties of UserAssignments
type PROPERTY_NAME = 'productName' | 'roleName' | 'resource' | 'action'

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
  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config)
  }
  @ViewChild('permissionTable') permissionTable: Table | undefined
  @ViewChild('permissionTableFilterInput') permissionTableFilter: ElementRef | undefined

  public userAssignments$: Observable<UserAssignment[]> = of([])
  public columns
  public environment = environment
  public userAssignmentItems: UserAssignment[] = []
  public loadingExceptionKey = ''
  public searchInProgress = false

  constructor(
    @Inject(BASE_URL) private baseUrl: ReplaySubject<string>,
    private readonly userService: UserService,
    private readonly userApi: UserAPIService,
    private readonly translate: TranslateService
  ) {
    this.userService.lang$.subscribe((lang) => this.translate.use(lang))
    this.columns = [
      {
        field: 'resource',
        header: 'USER_ROLE_PERMISSIONS.RESOURCE',
        tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.RESOURCE',
        filter: true
      },
      {
        field: 'action',
        header: 'USER_ROLE_PERMISSIONS.ACTION',
        tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.ACTION',
        filter: true
      },
      {
        field: 'productName',
        header: 'USER_ROLE_PERMISSIONS.PRODUCT',
        tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.PRODUCT',
        filter: true
      },
      {
        field: 'roleName',
        header: 'USER_ROLE_PERMISSIONS.ROLE',
        tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.ROLE',
        filter: true
      }
    ]
  }

  public ocxInitRemoteComponent(remoteComponentConfig: RemoteComponentConfig) {
    this.baseUrl.next(remoteComponentConfig.baseUrl)
    this.userApi.configuration = new Configuration({
      basePath: Location.joinWithSlash(remoteComponentConfig.baseUrl, environment.apiPrefix)
    })
  }

  public ngOnInit(): void {
    this.onReload()
  }

  public onReload() {
    this.userAssignments$ = this.searchUserAssignments()
  }

  public searchUserAssignments(): Observable<UserAssignment[]> {
    this.searchInProgress = true
    return this.userApi.getUserAssignments({ userCriteria: { pageSize: 1000 } }).pipe(
      map((pageResult: UserAssignmentPageResult) => {
        return pageResult.stream ?? []
      }),
      catchError((err) => {
        this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS'
        console.error('getUserAssignments():', err)
        return of([])
      }),
      finalize(() => (this.searchInProgress = false))
    )
  }

  public sortUserAssignments(a: UserAssignment, b: UserAssignment): number {
    return (
      (a.productName ? a.productName.toUpperCase() : '').localeCompare(
        b.productName ? b.productName.toUpperCase() : ''
      ) ||
      (a.applicationId ? a.applicationId.toUpperCase() : '').localeCompare(
        b.applicationId ? b.applicationId.toUpperCase() : ''
      ) ||
      (a.resource ? a.resource.toUpperCase() : '').localeCompare(b.resource ? b.resource.toUpperCase() : '') ||
      (a.action ? a.action.toUpperCase() : '').localeCompare(b.action ? b.action.toUpperCase() : '')
    )
  }

  /* Extract column values to fill drop down filter
   */
  public extractFilterItems(items: UserAssignment[], fieldName: PROPERTY_NAME): string[] {
    const arr: string[] = []
    items.forEach((item: UserAssignment) => {
      if (item[fieldName] && item[fieldName] !== '') if (!arr.includes(item[fieldName])) arr.push(item[fieldName])
    })
    return arr.sort(sortByLocale)
  }

  public applyGlobalFilter($event: Event, primengTable: Table): void {
    primengTable.filterGlobal(($event.target as HTMLInputElement).value, 'contains')
  }

  public onClearFilterUserAssignmentTable(): void {
    if (this.permissionTableFilter) {
      this.permissionTableFilter.nativeElement.value = ''
    }
  }
}
