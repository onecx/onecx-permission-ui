import { Component, ElementRef, NO_ERRORS_SCHEMA, Inject, Input, OnChanges, ViewChild } from '@angular/core'
import { CommonModule, Location } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { RouterModule } from '@angular/router'
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core'
import { catchError, finalize, map, Observable, of, ReplaySubject } from 'rxjs'
import { Table } from 'primeng/table'
import { SelectItem } from 'primeng/api'

import { UserService } from '@onecx/angular-integration-interface'
import { PortalCoreModule, createRemoteComponentTranslateLoader } from '@onecx/portal-integration-angular'
import {
  AngularRemoteComponentsModule,
  BASE_URL,
  RemoteComponentConfig,
  ocxRemoteComponent,
  ocxRemoteWebcomponent,
  provideTranslateServiceForRoot
} from '@onecx/angular-remote-components'

import {
  AssignmentAPIService,
  Configuration,
  UserAPIService,
  UserAssignment,
  UserAssignmentPageResult
} from '../../shared/generated'
import { SharedModule } from '../../shared/shared.module'
import { sortByLocale } from '../../shared/utils'
import { environment } from '../../../environments/environment'

// properties of UserAssignments
type PROPERTY_NAME = 'productName' | 'roleName' | 'resource' | 'action'
type ExtendedSelectItem = SelectItem & { isUserAssignedRole: boolean }

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
  ],
  schemas: [NO_ERRORS_SCHEMA]
})
export class OneCXUserRolesPermissionsComponent implements ocxRemoteComponent, ocxRemoteWebcomponent, OnChanges {
  @Input() userId: string | undefined = undefined
  @Input() displayName: string | undefined = undefined
  @Input() active: boolean | undefined = undefined // this is set actively on call the component
  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config)
  }
  @ViewChild('permissionTable') permissionTable: Table | undefined
  @ViewChild('permissionTableFilterInput') permissionTableFilter: ElementRef | undefined

  public userAssignments$: Observable<UserAssignment[]> = of([])
  public iamRoles$: Observable<ExtendedSelectItem[]> = of([])
  public columns
  public environment = environment
  public exceptionKey: string | undefined = undefined
  public exceptionKeyIamRoles: string | undefined = undefined
  public loading = false
  public loadingIamRoles = false

  constructor(
    @Inject(BASE_URL) private readonly baseUrl: ReplaySubject<string>,
    private readonly userService: UserService,
    private readonly userApi: UserAPIService,
    private readonly assgnmtApi: AssignmentAPIService,
    private readonly translate: TranslateService
  ) {
    this.userService.lang$.subscribe((lang) => this.translate.use(lang))
    this.columns = this.prepareColumn()
  }

  public ocxInitRemoteComponent(remoteComponentConfig: RemoteComponentConfig) {
    this.loading = true
    this.baseUrl.next(remoteComponentConfig.baseUrl)
    this.userApi.configuration = new Configuration({
      basePath: Location.joinWithSlash(remoteComponentConfig.baseUrl, environment.apiPrefix)
    })
    this.assgnmtApi.configuration = new Configuration({
      basePath: Location.joinWithSlash(remoteComponentConfig.baseUrl, environment.apiPrefix)
    })
  }

  public ngOnChanges(): void {
    if (this.active !== undefined) this.onReload()
  }

  public onReload() {
    this.userAssignments$ = this.searchUserAssignments()
  }

  public searchUserAssignments(): Observable<UserAssignment[]> {
    this.loading = true
    this.exceptionKey = undefined
    // on admin view the userId is set, otherwise the me services are used
    if (this.userId) {
      return this.assgnmtApi
        .searchUserAssignments({ assignmentUserSearchCriteria: { userId: this.userId, pageSize: 1000 } })
        .pipe(
          map((pageResult: UserAssignmentPageResult) => {
            return pageResult.stream ?? []
          }),
          catchError((err) => {
            if (err.error?.errorCode === '400' && err.error?.detail === 'USER_NOT_FOUND')
              this.exceptionKey = 'EXCEPTIONS.NOT_FOUND.USER'
            else this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS'
            console.error('searchUserAssignments', err)
            return of([])
          }),
          finalize(() => (this.loading = false))
        )
    } else {
      return this.userApi.getUserAssignments({ userCriteria: { pageSize: 1000 } }).pipe(
        map((pageResult: UserAssignmentPageResult) => {
          return pageResult.stream ?? []
        }),
        catchError((err) => {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS'
          console.error('getUserAssignments():', err)
          return of([])
        }),
        finalize(() => (this.loading = false))
      )
    }
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
    arr.sort(sortByLocale)
    return arr
  }

  public applyGlobalFilter($event: Event, primengTable: Table): void {
    primengTable.filterGlobal(($event.target as HTMLInputElement).value, 'contains')
  }

  public onClearFilterUserAssignmentTable(): void {
    if (this.permissionTableFilter) {
      this.permissionTableFilter.nativeElement.value = ''
    }
  }

  private prepareColumn() {
    return [
      {
        field: 'resource',
        header: 'USER_PERMISSIONS.RESOURCE',
        tooltip: 'USER_PERMISSIONS.TOOLTIPS.RESOURCE',
        filter: true,
        value: null
      },
      {
        field: 'action',
        header: 'USER_PERMISSIONS.ACTION',
        tooltip: 'USER_PERMISSIONS.TOOLTIPS.ACTION',
        filter: true,
        value: null
      },
      {
        field: 'productName',
        header: 'USER_PERMISSIONS.PRODUCT',
        tooltip: 'USER_PERMISSIONS.TOOLTIPS.PRODUCT',
        filter: true,
        value: null
      },
      {
        field: 'roleName',
        header: 'USER_PERMISSIONS.ROLE',
        tooltip: 'USER_PERMISSIONS.TOOLTIPS.ROLE',
        filter: true,
        value: null
      }
    ]
  }
  // activate TAB
  public onTabChange($event: any, items: UserAssignment[]) {
    if ($event.index === 2) this.iamRoles$ = this.getIamRoles(this.extractFilterItems(items, 'roleName'))
  }

  public getIamRoles(assignedRoles: string[]): Observable<ExtendedSelectItem[]> {
    this.loadingIamRoles = false
    this.exceptionKeyIamRoles = undefined
    console.log('getIamRoles user => ' + this.userId)

    // on admin view the userId is set, otherwise the me services are used
    if (this.userId) {
      this.loadingIamRoles = false
      return of([])
      // get other user stuff
    } else {
      return this.userApi.getTokenRoles().pipe(
        map((data) => {
          const roles: ExtendedSelectItem[] = []
          data.forEach((role) =>
            roles.push({
              label: role,
              isUserAssignedRole: assignedRoles.includes(role)
            } as ExtendedSelectItem)
          )
          return roles
        }),
        catchError((err) => {
          this.exceptionKeyIamRoles = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.ROLES'
          console.error('getTokenRoles', err)
          return of([])
        }),
        finalize(() => (this.loadingIamRoles = false))
      )
    }
  }
}
