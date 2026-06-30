import { Component, OnDestroy, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { combineLatest, map, of, Observable, Subject, catchError, BehaviorSubject } from 'rxjs'
import { TranslateModule, TranslateService } from '@ngx-translate/core'

import { ButtonModule } from 'primeng/button'
import { CardModule } from 'primeng/card'
import { FloatLabelModule } from 'primeng/floatlabel'
import { InputGroupModule } from 'primeng/inputgroup'
import { InputGroupAddonModule } from 'primeng/inputgroupaddon'
import { MessageModule } from 'primeng/message'
import { SelectButtonModule } from 'primeng/selectbutton'
import { SelectItem } from 'primeng/api'
import { ToastModule } from 'primeng/toast'
import { TooltipModule } from 'primeng/tooltip'

import { PortalMessageService } from '@onecx/angular-integration-interface'
import { PortalPageComponent } from '@onecx/angular-utils'
import {
  Action,
  AngularAcceleratorModule,
  ColumnType,
  RowListGridData,
  DataSortDirection,
  DataTableColumn,
  Filter,
  FilterType,
  ObjectUtils
} from '@onecx/angular-accelerator'

import {
  Application,
  ApplicationAPIService,
  WorkspaceAbstract,
  WorkspaceAPIService,
  WorkspacePageResult,
  ApplicationPageResult
} from 'src/app/shared/generated'
import { Utils } from 'src/app/shared/utils'
import { OcxChipComponent } from 'src/app/shared/ocx-chip/ocx-chip.component'

import { PermissionExportComponent } from 'src/app/permission/permission-export/permission-export.component'
import { PermissionImportComponent } from 'src/app/permission/permission-import/permission-import.component'

export interface AppSearchCriteria {
  appId: FormControl<string | null>
  appType: FormControl<AppFilterType | null>
  name: FormControl<string | null>
}
export type App = Application & { apps?: number; appType: AppType; displayName?: string }
export type AppType = 'APP' | 'PRODUCT' | 'WORKSPACE'
export type AppFilterType = 'ALL' | AppType
@Component({
  standalone: true,
  imports: [
    AngularAcceleratorModule,
    PortalPageComponent,
    CommonModule,
    ButtonModule,
    CardModule,
    FloatLabelModule,
    FormsModule,
    ReactiveFormsModule,
    InputGroupModule,
    InputGroupAddonModule,
    MessageModule,
    SelectButtonModule,
    ToastModule,
    TooltipModule,
    TranslateModule,
    PermissionExportComponent,
    PermissionImportComponent,
    OcxChipComponent
  ],
  templateUrl: './app-search.component.html',
  styleUrls: ['./app-search.component.scss']
})
export class AppSearchComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject()
  // data
  public apps$!: Observable<(App & RowListGridData)[]>
  public filteredApps$!: Observable<(App & RowListGridData)[]> // for dropdown list filtering
  public products$!: Observable<(App & RowListGridData)[]>
  public productNames$!: Observable<string[]>
  private workspaces$!: Observable<WorkspacePageResult>
  public appSearchCriteria!: FormGroup<AppSearchCriteria>
  // dialog control
  public actions$: Observable<Action[]> | undefined
  public loading = false
  public exceptionKey: string | undefined = undefined
  public viewMode = 'grid'
  public appTypeItems$: Observable<SelectItem[]> | undefined
  public quickFilterItems$: Observable<SelectItem[]> | undefined
  public quickFilterValue: AppFilterType = 'ALL'
  public typeFilterValue$ = new BehaviorSubject<string | undefined>(undefined)
  public textFilterValue$ = new BehaviorSubject<string | undefined>(undefined)
  public globalFilterValue = ''
  public filters$: Observable<Filter[]>
  public sortDirection: DataSortDirection = DataSortDirection.ASCENDING
  public sortField = 'displayName'
  public sortOrder = -1

  public displayExportDialog = false
  public displayImportDialog = false

  public columnTypes: DataTableColumn[] = [
    { columnType: ColumnType.STRING, id: 'displayName', nameKey: 'APP.DISPLAY_NAME', sortable: true },
    { columnType: ColumnType.STRING, id: 'appType', nameKey: 'DIALOG.DETAIL.FILTER.APP_TYPE', sortable: true },
    { columnType: ColumnType.STRING, id: 'appId', nameKey: '' }
  ]

  constructor(
    private readonly appApi: ApplicationAPIService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translate: TranslateService,
    private readonly msgService: PortalMessageService,
    private readonly workspaceApi: WorkspaceAPIService
  ) {
    // search criteria
    this.appSearchCriteria = new FormGroup<AppSearchCriteria>({
      appId: new FormControl<string | null>(null),
      appType: new FormControl<AppFilterType | null>('WORKSPACE'),
      name: new FormControl<string | null>(null)
    })
    this.appSearchCriteria.controls['appType'].setValue('ALL') // default: all app types
    this.appSearchCriteria.controls['name'].disable()
    this.filters$ = this.typeFilterValue$.pipe(
      map((typeValue) => {
        const filters: Filter[] = []
        if (typeValue) {
          filters.push({ columnId: 'appType', value: typeValue, filterType: FilterType.EQUALS })
        }
        return filters
      })
    )
  }

  ngOnInit(): void {
    this.prepareAppTypeItems()
    this.prepareQuickFilterItems()
    this.prepareDialogTranslations()
    this.searchApps()
  }
  public ngOnDestroy(): void {
    this.destroy$.next(undefined)
    this.destroy$.complete()
  }

  /**
   * SEARCH
   */
  public onSearch() {
    this.searchApps()
  }
  public onSearchReset() {
    this.appSearchCriteria.reset({ appType: 'ALL' })
    this.apps$ = of([] as (App & RowListGridData)[])
    this.filteredApps$ = of([] as (App & RowListGridData)[])
  }

  /**
   * Workspaces groups Products(Apps) by registration
   */
  private searchWorkspaces(appType?: string): Observable<(App & RowListGridData)[]> {
    this.workspaces$ = this.workspaceApi
      .searchWorkspaces({
        workspaceSearchCriteria: {
          workspaceName: appType === 'WORKSPACE' ? (this.appSearchCriteria.controls['name'].value ?? '') : undefined
        }
      })
      .pipe(
        catchError((err) => {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.WORKSPACE'
          console.error('searchWorkspaces', err)
          return of({})
        })
      )
    return this.workspaces$.pipe(
      map((result) => {
        return result.stream
          ? result.stream
              ?.map((w: WorkspaceAbstract) => {
                return {
                  appId: w.name,
                  appType: 'WORKSPACE',
                  description: w.description,
                  displayName: w.displayName,
                  imagePath: ''
                } as App & RowListGridData
              })
              .sort(this.sortAppsByDisplayName)
          : []
      })
    )
  }
  // Product => a group of Permission Applications with same product name
  private searchProducts(searchAppType?: string): Observable<(App & RowListGridData)[]> {
    const papps$: Observable<ApplicationPageResult> = this.appApi
      .searchApplications({
        applicationSearchCriteria: {
          appId: searchAppType === 'APP' ? (this.appSearchCriteria.controls['name'].value ?? '') : undefined,
          productName: searchAppType === 'PRODUCT' ? (this.appSearchCriteria.controls['name'].value ?? '') : undefined,
          pageSize: 1000
        }
      })
      .pipe(
        catchError((err) => {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.APPS'
          console.error('searchApplications', err)
          return of({})
        })
      )
    return papps$.pipe(
      map((result) => {
        if (!result.stream) return []
        const productNames: string[] = []
        const apps: (App & RowListGridData)[] = []
        result.stream?.map((app: Application) => {
          if (productNames.includes(app.productName!)) {
            const ap: App[] = apps.filter((a) => a.productName === app.productName)
            if (ap.length === 1 && ap[0].apps) ap[0].apps++
          } else {
            productNames.push(app.productName!)
            apps.push({ ...app, appType: 'PRODUCT', displayName: app.productName, apps: 1 } as App & RowListGridData)
          }
        })
        return apps.sort(this.sortAppsByDisplayName)
      })
    )
  }

  public searchApps(): void {
    this.loading = true
    this.exceptionKey = undefined
    switch (this.appSearchCriteria.controls['appType'].value) {
      case 'ALL':
        this.apps$ = combineLatest([this.searchWorkspaces(), this.searchProducts('PRODUCT')]).pipe(
          map(([w, a]: [(App & RowListGridData)[], (App & RowListGridData)[]]) =>
            w.concat(a).sort(this.sortAppsByDisplayName)
          )
        )
        break
      case 'WORKSPACE':
        this.apps$ = this.searchWorkspaces('WORKSPACE')
        break
      case 'APP':
      case 'PRODUCT':
        this.apps$ = this.searchProducts(this.appSearchCriteria.controls['appType'].value)
        break
    }
    this.filteredApps$ = combineLatest([this.apps$, this.filters$, this.textFilterValue$]).pipe(
      map(([apps, filters, textFilter]) => {
        this.loading = false
        let result = apps.filter((app) => {
          return filters.every((filter) => {
            return filter.filterType === FilterType.EQUALS
              ? ObjectUtils.resolveFieldData(app, filter.columnId) === filter.value
              : (ObjectUtils.resolveFieldData(app, filter.columnId)?.includes(filter.value) ?? false)
          })
        })
        if (textFilter) {
          const lowerFilter = textFilter.toLowerCase()
          result = result.filter((app) => {
            return (
              (app.displayName?.toLowerCase()?.includes(lowerFilter) ?? false) ||
              (app.productName?.toLowerCase()?.includes(lowerFilter) ?? false) ||
              (app.appId?.toLowerCase()?.includes(lowerFilter) ?? false)
            )
          })
        }
        return result
      })
    )
  }

  private sortAppsByDisplayName(a: App, b: App): number {
    return (
      a.appType.toUpperCase().localeCompare(b.appType.toUpperCase()) ||
      (a.displayName ?? '').toUpperCase().localeCompare((b.displayName ?? '').toUpperCase())
    )
  }

  /**
   * Dialog preparation
   */
  public prepareAppTypeItems(): void {
    this.appTypeItems$ = this.translate
      .get([
        'DIALOG.SEARCH.FILTER.ALL',
        'DIALOG.SEARCH.FILTER.WORKSPACE',
        'DIALOG.SEARCH.FILTER.PRODUCT',
        'DIALOG.SEARCH.FILTER.APP'
      ])
      .pipe(
        map((data) => {
          return [
            { label: data['DIALOG.SEARCH.FILTER.ALL'], value: 'ALL' },
            { label: data['DIALOG.SEARCH.FILTER.WORKSPACE'], value: 'WORKSPACE' },
            { label: data['DIALOG.SEARCH.FILTER.PRODUCT'], value: 'PRODUCT' },
            { label: data['DIALOG.SEARCH.FILTER.APP'], value: 'APP' }
          ]
        })
      )
  }
  public prepareQuickFilterItems(): void {
    this.quickFilterItems$ = this.translate
      .get([
        'DIALOG.SEARCH.QUICK_FILTER.ALL',
        'DIALOG.SEARCH.QUICK_FILTER.WORKSPACE',
        'DIALOG.SEARCH.QUICK_FILTER.PRODUCT'
      ])
      .pipe(
        map((data) => {
          return [
            { label: data['DIALOG.SEARCH.QUICK_FILTER.ALL'], value: 'ALL' },
            { label: data['DIALOG.SEARCH.QUICK_FILTER.WORKSPACE'], value: 'WORKSPACE' },
            { label: data['DIALOG.SEARCH.QUICK_FILTER.PRODUCT'], value: 'PRODUCT' }
          ]
        })
      )
  }
  private prepareDialogTranslations(): void {
    this.actions$ = this.translate
      .get([
        'ACTIONS.EXPORT.LABEL',
        'ACTIONS.EXPORT.ASSIGNMENT.TOOLTIP',
        'ACTIONS.IMPORT.LABEL',
        'ACTIONS.IMPORT.ASSIGNMENT.TOOLTIP'
      ])
      .pipe(
        map((data) => {
          return [
            {
              label: data['ACTIONS.EXPORT.LABEL'],
              title: data['ACTIONS.EXPORT.ASSIGNMENT.TOOLTIP'],
              actionCallback: () => this.onExport(),
              icon: 'pi pi-download',
              show: 'always',
              permission: 'PERMISSION#EDIT'
            },
            {
              label: data['ACTIONS.IMPORT.LABEL'],
              title: data['ACTIONS.IMPORT.ASSIGNMENT.TOOLTIP'],
              actionCallback: () => this.onOpenImport(),
              icon: 'pi pi-upload',
              show: 'always',
              permission: 'PERMISSION#EDIT'
            }
          ]
        })
      )
  }

  /*
   *  IMPORT
   */
  public onOpenImport(): void {
    this.displayImportDialog = true
  }

  /**
   * EXPORT
   */
  public onExport(): void {
    this.displayExportDialog = true
    this.productNames$ = this.apps$.pipe(
      map((products) =>
        Array.from(products.filter((app) => app.appType === 'PRODUCT').map((p) => p.displayName!)).sort(
          Utils.sortByLocale
        )
      )
    )
  }

  /**
   * UI Events
   */
  public onAppClick(app: App): void {
    this.router.navigate(['./', app.appType.toLowerCase(), app.appType === 'PRODUCT' ? app.productName : app.appId], {
      relativeTo: this.route
    })
  }
  public onAppTypeCriteriaChange(ev: any): void {
    if (ev.value) this.appSearchCriteria.controls['appType'].setValue(ev.value)
    if (ev.value === 'ALL') this.appSearchCriteria.controls['name'].disable()
    else this.appSearchCriteria.controls['name'].enable()
  }

  /**
   * FILTER & SORT Events
   */
  public onQuickFilterChange(ev: any): void {
    if (ev.value) this.quickFilterValue = ev.value
    if (this.quickFilterValue === 'ALL') this.typeFilterValue$.next('')
    else this.typeFilterValue$.next(this.quickFilterValue)
  }
  public onFilterChange(filter: string): void {
    this.textFilterValue$.next(filter)
  }
  public onGlobalFilter(value: string): void {
    this.globalFilterValue = value
    this.textFilterValue$.next(value)
  }
  public onClearGlobalFilter(): void {
    this.globalFilterValue = ''
    this.textFilterValue$.next(undefined)
  }

  public onSortChange(sort: string | { sortColumn: string; sortDirection: DataSortDirection }): void {
    if (typeof sort === 'string') {
      this.sortField = sort
      return
    }

    this.sortField = sort.sortColumn
    this.sortDirection = sort.sortDirection
    let sortOrder = 0
    if (sort.sortDirection === DataSortDirection.ASCENDING) {
      sortOrder = -1
    } else if (sort.sortDirection === DataSortDirection.DESCENDING) {
      sortOrder = 1
    }
    this.sortOrder = sortOrder
  }
  public onSortDirChange(asc: boolean): void {
    this.sortOrder = asc ? -1 : 1
    this.sortDirection = asc ? DataSortDirection.ASCENDING : DataSortDirection.DESCENDING
  }
}
