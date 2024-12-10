import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  NO_ERRORS_SCHEMA,
  Inject,
  Input,
  ViewChild,
  Renderer2,
  AfterViewInit,
  OnChanges
} from '@angular/core'
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

import {
  AssignmentAPIService,
  Configuration,
  UserAPIService,
  UserAssignment,
  UserAssignmentPageResult
} from 'src/app/shared/generated'
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
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
})
export class OneCXUserRolesPermissionsComponent
  implements ocxRemoteComponent, ocxRemoteWebcomponent, OnChanges, AfterViewInit
{
  @Input() userId: string | undefined = undefined
  @Input() displayName: string | undefined = undefined
  @Input() active: boolean | undefined = undefined // this is set actively on call the component
  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config)
  }
  @ViewChild('permissionTable') permissionTable: Table | undefined
  @ViewChild('permissionTableFilterInput') permissionTableFilter: ElementRef | undefined

  public userAssignments$: Observable<UserAssignment[]> = of([])
  public columns
  public environment = environment
  public exceptionKey: string | undefined = undefined
  public loading = false

  constructor(
    @Inject(BASE_URL) private readonly baseUrl: ReplaySubject<string>,
    private readonly userService: UserService,
    private readonly userApi: UserAPIService,
    private readonly assgnmtApi: AssignmentAPIService,
    private readonly translate: TranslateService,
    private readonly renderer: Renderer2,
    private readonly elem: ElementRef
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

  // remove styles set by lib (why ever)
  public ngAfterViewInit() {
    try {
      const el = this.renderer.selectRootElement('.buttonDialogScrollableContent', true)
      if (el) {
        this.renderer.setStyle(el, 'overflow', 'unset')
        this.renderer.setStyle(el, 'max-height', 'unset')
        this.renderer.setStyle(el, 'margin-bottom', '10px')
      }
    } catch (err) {} // ignore runtime error if component not used within dialog
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
        header: 'USER_ROLE_PERMISSIONS.RESOURCE',
        tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.RESOURCE',
        filter: true,
        value: null
      },
      {
        field: 'action',
        header: 'USER_ROLE_PERMISSIONS.ACTION',
        tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.ACTION',
        filter: true,
        value: null
      },
      {
        field: 'productName',
        header: 'USER_ROLE_PERMISSIONS.PRODUCT',
        tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.PRODUCT',
        filter: true,
        value: null
      },
      {
        field: 'roleName',
        header: 'USER_ROLE_PERMISSIONS.ROLE',
        tooltip: 'USER_ROLE_PERMISSIONS.TOOLTIPS.ROLE',
        filter: true,
        value: null
      }
    ]
  }
}
