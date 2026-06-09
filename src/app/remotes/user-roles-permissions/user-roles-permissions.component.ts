import { Component, ElementRef, EventEmitter, Inject, Input, OnChanges, ViewChild } from '@angular/core'
import { CommonModule, Location } from '@angular/common'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { catchError, finalize, map, Observable, of, ReplaySubject } from 'rxjs'

import { SelectItem } from 'primeng/api'
import { ButtonModule } from 'primeng/button'
import { FloatLabelModule } from 'primeng/floatlabel'
import { InputGroupModule } from 'primeng/inputgroup'
import { InputGroupAddonModule } from 'primeng/inputgroupaddon'
import { InputTextModule } from 'primeng/inputtext'
import { ListboxModule } from 'primeng/listbox'
import { MessageModule } from 'primeng/message'
import { SelectModule } from 'primeng/select'
import { Table, TableModule } from 'primeng/table'
import { TabsModule } from 'primeng/tabs'
import { TooltipModule } from 'primeng/tooltip'

import { AppConfigService, UserService } from '@onecx/angular-integration-interface'
import {
  AngularRemoteComponentsModule,
  ocxRemoteComponent,
  ocxRemoteWebcomponent,
  SLOT_SERVICE,
  SlotService
} from '@onecx/angular-remote-components'
import { AngularAcceleratorModule } from '@onecx/angular-accelerator'
import { REMOTE_COMPONENT_CONFIG, RemoteComponentConfig } from '@onecx/angular-utils'

import {
  AssignmentAPIService,
  Configuration,
  Role,
  UserAPIService,
  UserAssignment,
  UserAssignmentPageResult
} from 'src/app/shared/generated'
import { sortByLocale, sortSelectItemsByLabel } from 'src/app/shared/utils'
import { environment } from 'src/environments/environment'

// properties of UserAssignments
type PROPERTY_NAME = 'productName' | 'roleName' | 'resource' | 'action'
export type ExtendedSelectItem = SelectItem & { isUserAssignedRole: boolean }

export function slotInitializer(slotService: SlotService) {
  return () => slotService.init()
}

@Component({
  selector: 'app-user-roles-permissions',
  templateUrl: './user-roles-permissions.component.html',
  styleUrls: ['./user-roles-permissions.component.scss'],
  standalone: true,
  imports: [
    AngularAcceleratorModule,
    AngularRemoteComponentsModule,
    CommonModule,
    ButtonModule,
    FloatLabelModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputTextModule,
    ListboxModule,
    MessageModule,
    SelectModule,
    TranslateModule,
    TableModule,
    TabsModule,
    TooltipModule
  ],
  providers: [{ provide: SLOT_SERVICE, useExisting: SlotService }]
})
export class OneCXUserRolesPermissionsComponent implements ocxRemoteComponent, ocxRemoteWebcomponent, OnChanges {
  @Input() public userId: string | undefined = undefined // userId is set on admin mode
  @Input() public issuer: string | undefined = undefined // issuer is set on admin mode
  @Input() public displayName: string | undefined = undefined
  @Input() public active: boolean | undefined = undefined // this is set actively on call the component
  @Input() set ocxRemoteComponentConfig(config: RemoteComponentConfig) {
    this.ocxInitRemoteComponent(config)
  }
  @ViewChild('permissionTable') permissionTable: Table | undefined
  @ViewChild('permissionNameFilter') permissionTableFilter: ElementRef | undefined

  private userAssignedRoles: string[] = []
  public userAssignments$: Observable<UserAssignment[]> = of([])
  public idmRoles$: Observable<ExtendedSelectItem[]> = of([])
  public idmRoles: Role[] = [] // empty list is indicator to init slot
  public columns
  public environment = environment
  public exceptionKey: string | undefined = undefined
  public exceptionKeyIdmRoles: string | undefined = undefined
  public loading = false
  public selectedTabIndex = 0

  // manage slot to get roles from iam
  public loadingIdmRoles = false
  public isComponentDefined = false
  public componentPermissions: string[] = []
  public slotName = 'onecx-permission-iam-user-roles'
  public roleListEmitter = new EventEmitter<Role[]>()
  private readonly roleListboxOptionsCache = new WeakMap<UserAssignment[], SelectItem[]>()
  private readonly productListboxOptionsCache = new WeakMap<UserAssignment[], SelectItem[]>()

  constructor(
    @Inject(REMOTE_COMPONENT_CONFIG)
    private readonly remoteComponentConfig: ReplaySubject<RemoteComponentConfig>,
    private readonly appConfigService: AppConfigService,
    private readonly slotService: SlotService,
    private readonly translateService: TranslateService,
    private readonly userService: UserService,
    private readonly userApi: UserAPIService,
    private readonly assgnmtApi: AssignmentAPIService
  ) {
    this.userService.lang$.subscribe((lang) => this.translateService.use(lang))
    this.columns = this.prepareColumn()
  }

  // initialize this component as remote
  public ocxInitRemoteComponent(config: RemoteComponentConfig): void {
    this.userApi.configuration = new Configuration({
      basePath: Location.joinWithSlash(config.baseUrl, environment.apiPrefix)
    })
    this.assgnmtApi.configuration = new Configuration({
      basePath: Location.joinWithSlash(config.baseUrl, environment.apiPrefix)
    })
    this.appConfigService.init(config['baseUrl'])
    this.remoteComponentConfig.next(config)
    this.componentPermissions = config.permissions
    slotInitializer(this.slotService)()
  }

  public ngOnChanges(): void {
    if (this.active !== undefined) {
      if (this.userId && !this.issuer) {
        this.exceptionKey = 'EXCEPTIONS.MISSING_ISSUER'
        return
      }
      this.loadingIdmRoles = true
      if (!this.isComponentDefined) {
        // check if the iam component is assigned to the slot
        this.slotService.isSomeComponentDefinedForSlot(this.slotName).subscribe((def) => {
          this.isComponentDefined = def
          if (this.isComponentDefined) {
            // receive data from remote component
            this.roleListEmitter.subscribe((list: Role[]) => {
              this.loadingIdmRoles = false
              this.idmRoles = list
              this.idmRoles$ = this.provideIamRoles()
            })
          }
        })
      }
      this.onReload()
    }
  }

  public onReload() {
    this.idmRoles = []
    this.userAssignedRoles = []
    this.userAssignments$ = this.searchUserAssignments()
  }

  public searchUserAssignments(): Observable<UserAssignment[]> {
    this.loading = true
    this.exceptionKey = undefined
    // on admin view the userId is set, otherwise the me services are used
    if (this.userId && this.issuer) {
      return this.assgnmtApi
        .searchUserAssignments({
          assignmentUserSearchCriteria: { userId: this.userId, issuer: this.issuer, pageSize: 1000 }
        })
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
      // on user view get my permissions
      return this.userApi.getUserAssignments({ userCriteria: { pageSize: 1000 } }).pipe(
        map((pageResult: UserAssignmentPageResult) => {
          return pageResult.stream?.sort(this.sortUserAssignments) ?? []
        }),
        catchError((err) => {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS'
          console.error('getUserAssignments', err)
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

  // activate TAB
  public onTabChange(tabValue: any, uas: UserAssignment[]) {
    const selectedTab = typeof tabValue === 'object' ? tabValue.index : Number(tabValue)
    this.selectedTabIndex = selectedTab
    if (selectedTab === 2) {
      this.userAssignedRoles = this.extractFilterItems(uas, 'roleName')
      this.idmRoles$ = this.provideIamRoles() // used for me permissions
    }
  }

  private provideIamRoles(): Observable<ExtendedSelectItem[]> {
    this.exceptionKeyIdmRoles = undefined
    const roles: ExtendedSelectItem[] = []

    // on admin view the userId is set and iam roles will get from remote, otherwise the me services are used
    if (this.userId) {
      this.idmRoles.forEach((role) =>
        roles.push({
          label: role.name,
          isUserAssignedRole: this.userAssignedRoles.includes(role.name!)
        } as ExtendedSelectItem)
      )
      return of(roles)
    }
    // user in private context: get roles from token (if not yet done)
    if (this.idmRoles.length > 0) {
      this.idmRoles?.forEach((r) => {
        roles.push({
          label: r.name,
          isUserAssignedRole: this.userAssignedRoles.includes(r.name!)
        } as ExtendedSelectItem)
      })
      roles.sort(sortSelectItemsByLabel)
      return of(roles)
    } else {
      this.loadingIdmRoles = true
      return this.userApi.getTokenRoles().pipe(
        map((data) => {
          data.forEach((role) => {
            this.idmRoles?.push({ name: role })
            roles.push({
              label: role,
              isUserAssignedRole: this.userAssignedRoles.includes(role)
            } as ExtendedSelectItem)
          })
          return roles.sort(sortSelectItemsByLabel)
        }),
        catchError((err) => {
          this.exceptionKeyIdmRoles = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.ROLES'
          console.error('getTokenRoles', err)
          return of([])
        }),
        finalize(() => (this.loadingIdmRoles = false))
      )
    }
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

  public getRoleListboxOptions(items: UserAssignment[]): SelectItem[] {
    const cached = this.roleListboxOptionsCache.get(items)
    if (cached) return cached

    const options = this.extractFilterItems(items, 'roleName').map((value) => ({ label: value, value }))
    this.roleListboxOptionsCache.set(items, options)
    return options
  }

  public getProductListboxOptions(items: UserAssignment[]): SelectItem[] {
    const cached = this.productListboxOptionsCache.get(items)
    if (cached) return cached

    const options = this.extractFilterItems(items, 'productName').map((value) => ({ label: value, value }))
    this.productListboxOptionsCache.set(items, options)
    return options
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
}
