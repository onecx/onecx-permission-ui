import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { FormControl, FormGroup } from '@angular/forms'
import { combineLatest, map, of, Observable, Subject, catchError, BehaviorSubject } from 'rxjs'
import { TranslateService } from '@ngx-translate/core'
import { SelectItem } from 'primeng/api'
import { DataView } from 'primeng/dataview'
import { FileSelectEvent } from 'primeng/fileupload'

import {
  Action,
  ColumnType,
  DataSortDirection,
  DataTableColumn,
  DataViewControlTranslations,
  Filter,
  ObjectUtils,
  PortalMessageService,
  RowListGridData
} from '@onecx/portal-integration-angular'

import { limitText, sortByLocale } from 'src/app/shared/utils'
import {
  Application,
  ApplicationAPIService,
  AssignmentAPIService,
  WorkspaceAbstract,
  WorkspaceAPIService,
  WorkspacePageResult,
  ApplicationPageResult,
  Permission
} from 'src/app/shared/generated'

export interface AppSearchCriteria {
  appId: FormControl<string | null>
  appType: FormControl<AppFilterType | null>
  name: FormControl<string | null>
}
export type App = Application & { apps?: number; appType: AppType; displayName?: string }
export type AppType = 'APP' | 'PRODUCT' | 'WORKSPACE'
export type AppFilterType = 'ALL' | AppType

@Component({
  templateUrl: './app-search.component.html',
  styleUrls: ['./app-search.component.scss']
})
export class AppSearchComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject()
  public actions$: Observable<Action[]> | undefined
  // data
  public apps$!: Observable<(App & RowListGridData)[]>
  public filteredApps$!: Observable<(App & RowListGridData)[]>
  private papps$!: Observable<ApplicationPageResult>
  public products$!: Observable<(App & RowListGridData)[]>
  public productNames: string[] = []
  private workspaces$!: Observable<WorkspacePageResult>
  public appSearchCriteriaGroup!: FormGroup<AppSearchCriteria>
  // dialog control
  public loading = false
  public exceptionKey: string | undefined = undefined
  public viewMode = 'grid'
  public appTypeItems$: Observable<SelectItem[]> | undefined
  public appTypeFilterValue: string = 'ALL'
  public quickFilterValue: AppFilterType = 'ALL'
  public quickFilterItems$: Observable<SelectItem[]> | undefined
  public typeFilterValue$ = new BehaviorSubject<string | undefined>(undefined)
  public textFilterValue$ = new BehaviorSubject<string | undefined>(undefined)
  public sortField = 'displayName'
  public sortOrder = -1

  public displayImportDialog = false
  public displayExportDialog = false

  importAssignmentItem: Permission | null = null
  public importError = false
  public validationErrorCause: string
  public selectedProductNames: string[] = []

  public limitText = limitText

  public columnTypes: DataTableColumn[] = [
    { columnType: ColumnType.STRING, id: 'name', nameKey: '' },
    { columnType: ColumnType.STRING, id: 'appType', nameKey: '' },
    { columnType: ColumnType.STRING, id: 'appId', nameKey: '' }
  ]
  public filters$: Observable<(Filter & { mode: 'contains' | 'equals' })[]>
  public sortDirection: DataSortDirection = DataSortDirection.ASCENDING

  public dataViewControlsTranslations: DataViewControlTranslations = {}
  @ViewChild(DataView) dv: DataView | undefined

  constructor(
    private readonly appApi: ApplicationAPIService,
    private readonly assgnmtApi: AssignmentAPIService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translate: TranslateService,
    private readonly msgService: PortalMessageService,
    private readonly workspaceApi: WorkspaceAPIService
  ) {
    // search criteria
    this.appSearchCriteriaGroup = new FormGroup<AppSearchCriteria>({
      appId: new FormControl<string | null>(null),
      appType: new FormControl<AppFilterType | null>('WORKSPACE'),
      name: new FormControl<string | null>(null)
    })
    this.appSearchCriteriaGroup.controls['appType'].setValue('ALL') // default: all app types
    this.appSearchCriteriaGroup.controls['name'].disable()
    this.filters$ = combineLatest([this.typeFilterValue$, this.textFilterValue$]).pipe(
      map(([typeValue, textFilter]) => {
        const filters: (Filter & { mode: 'contains' | 'equals' })[] = []
        if (typeValue) {
          filters.push({ columnId: 'appType', value: typeValue, mode: 'equals' })
        }
        if (textFilter) {
          filters.push({ columnId: 'displayName', value: textFilter, mode: 'contains' })
        }
        return filters
      })
    )
    this.validationErrorCause = ''
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
   *
   * Workspaces groups Products(Apps) by registration
   */
  private searchWorkspaces(appType?: string): Observable<(App & RowListGridData)[]> {
    this.workspaces$ = this.workspaceApi
      .searchWorkspaces({
        workspaceSearchCriteria: {
          workspaceName:
            appType === 'WORKSPACE' ? (this.appSearchCriteriaGroup.controls['name'].value ?? '') : undefined
        }
      })
      .pipe(
        catchError((err) => {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.WORKSPACE'
          console.error('getAllWorkspaceNames()', err)
          return of({} as WorkspacePageResult)
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
  // Product => Group of Permission Applications with same product name
  private searchProducts(searchAppType?: string): Observable<(App & RowListGridData)[]> {
    this.papps$ = this.appApi
      .searchApplications({
        applicationSearchCriteria: {
          appId: searchAppType === 'APP' ? (this.appSearchCriteriaGroup.controls['name'].value ?? '') : undefined,
          productName:
            searchAppType === 'PRODUCT' ? (this.appSearchCriteriaGroup.controls['name'].value ?? '') : undefined,
          pageSize: 1000
        }
      })
      .pipe(
        catchError((err) => {
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.APPS'
          console.error('searchApplications()', err)
          return of({} as ApplicationPageResult)
        })
      )
    return this.papps$.pipe(
      map((result) => {
        if (!result.stream) return []
        const productNames: string[] = []
        const apps: (App & RowListGridData)[] = []
        result.stream?.map((app: Application) => {
          if (!productNames.includes(app.productName!)) {
            productNames.push(app.productName!)
            apps.push({ ...app, appType: 'PRODUCT', displayName: app.productName, apps: 1 } as App & RowListGridData)
          } else {
            const ap: App[] = apps.filter((a) => a.productName === app.productName)
            if (ap.length === 1 && ap[0].apps) ap[0].apps++
          }
        })
        return apps.sort(this.sortAppsByDisplayName)
      })
    )
  }
  public searchApps(): void {
    this.loading = true
    this.exceptionKey = undefined
    switch (this.appSearchCriteriaGroup.controls['appType'].value) {
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
        this.apps$ = this.searchProducts(this.appSearchCriteriaGroup.controls['appType'].value)
        break
    }
    this.filteredApps$ = combineLatest([this.apps$, this.filters$]).pipe(
      map(([apps, filters]) => {
        this.loading = false
        return apps.filter((app) => {
          return filters.every((filter) => {
            return filter.mode === 'equals'
              ? ObjectUtils.resolveFieldData(app, filter.columnId) === filter.value
              : (ObjectUtils.resolveFieldData(app, filter.columnId)?.includes(filter.value) ?? false)
          })
        })
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
    this.translate
      .get([
        'APP.DISPLAY_NAME',
        'APP.TYPE',
        'ACTIONS.SEARCH.SORT_BY',
        'ACTIONS.SEARCH.FILTER.LABEL',
        'ACTIONS.SEARCH.FILTER.OF',
        'ACTIONS.SEARCH.SORT_DIRECTION_ASC',
        'ACTIONS.SEARCH.SORT_DIRECTION_DESC'
      ])
      .pipe(
        map((data) => {
          this.dataViewControlsTranslations = {
            sortDropdownPlaceholder: data['ACTIONS.SEARCH.SORT_BY'],
            filterInputPlaceholder: data['ACTIONS.SEARCH.FILTER.LABEL'],
            filterInputTooltip: data['ACTIONS.SEARCH.FILTER.OF'] + data['APP.DISPLAY_NAME'] + ', ' + data['APP.TYPE'],
            sortOrderTooltips: {
              ascending: data['ACTIONS.SEARCH.SORT_DIRECTION_ASC'],
              descending: data['ACTIONS.SEARCH.SORT_DIRECTION_DESC']
            },
            sortDropdownTooltip: data['ACTIONS.SEARCH.SORT_BY']
          }
        })
      )
      .subscribe()

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
              actionCallback: () => this.onImport(),
              icon: 'pi pi-upload',
              show: 'always',
              permission: 'PERMISSION#EDIT'
            }
          ]
        })
      )
  }

  /****************************************************************************
   *  IMPORT
   */
  public onImport(): void {
    this.displayImportDialog = true
  }
  public onSelect(event: FileSelectEvent): void {
    event.files[0].text().then((text) => {
      this.importError = false
      this.validationErrorCause = ''

      this.translate.get(['IMPORT.VALIDATION_RESULT']).subscribe(() => {
        try {
          const importPermission = JSON.parse(text)
          this.importAssignmentItem = importPermission
        } catch (err) {
          console.error('Import Error', err)
          this.importError = true
        }
      })
    })
  }
  public onImportConfirmation(): void {
    if (this.importAssignmentItem) {
      this.assgnmtApi.importAssignments({ body: this.importAssignmentItem }).subscribe({
        next: () => {
          this.displayImportDialog = false
          this.msgService.success({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.ASSIGNMENT.IMPORT_OK' })
        },
        error: () => this.msgService.error({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.ASSIGNMENT.IMPORT_NOK' })
      })
      this.searchApps()
    }
  }
  public isFileValid(): boolean {
    return !this.importError
  }
  public onCloseImportDialog(): void {
    this.displayImportDialog = false
  }
  public onClear(): void {
    this.importError = false
    this.validationErrorCause = ''
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
    if (ev.value) this.appTypeFilterValue = ev.value
    if (ev.value === 'ALL') this.appSearchCriteriaGroup.controls['name'].disable()
    else this.appSearchCriteriaGroup.controls['name'].enable()
  }
  public onQuickFilterChange(ev: any): void {
    if (ev.value === 'ALL') this.typeFilterValue$.next('')
    else if (ev.value) this.typeFilterValue$.next(ev.value)
  }
  public onFilterChange(filter: string): void {
    this.textFilterValue$.next(filter)
  }
  public onSortChange(field: string): void {
    this.sortField = field
  }
  public onSortDirChange(asc: boolean): void {
    this.sortOrder = asc ? -1 : 1
    this.sortDirection = asc ? DataSortDirection.ASCENDING : DataSortDirection.DESCENDING
  }
  public onSearch() {
    this.searchApps()
  }
  public onSearchReset() {
    this.appSearchCriteriaGroup.reset({ appType: 'ALL' })
    this.apps$ = of([] as (App & RowListGridData)[])
    this.filteredApps$ = of([] as (App & RowListGridData)[])
  }

  public onExport(): void {
    this.products$ = this.searchProducts() // search with max page size
    this.products$
      .pipe(
        map((products) => {
          this.productNames = Array.from(products.map((p) => p.displayName!)).sort(sortByLocale)
          this.displayExportDialog = true
        })
      )
      .subscribe()
  }
}
