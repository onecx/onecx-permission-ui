import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { FormControl, FormGroup } from '@angular/forms'
import { combineLatest, finalize, map, of, Observable, Subject, catchError, BehaviorSubject } from 'rxjs'
import { TranslateService } from '@ngx-translate/core'
import { SelectItem } from 'primeng/api'
import { DataView } from 'primeng/dataview'
import { ColumnType, DataSortDirection, Filter, ObjectUtils, RowListGridData } from '@onecx/portal-integration-angular'
import { DataTableColumn } from '@onecx/portal-integration-angular'

import { DataViewControlTranslations } from '@onecx/portal-integration-angular'
import { limitText } from 'src/app/shared/utils'

import {
  Application,
  ApplicationAPIService,
  WorkspaceAbstract,
  WorkspaceAPIService,
  WorkspacePageResult,
  ApplicationPageResult
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
  // data
  public apps$!: Observable<(App & RowListGridData)[]>
  public filteredApps$!: Observable<(App & RowListGridData)[]>
  private papps$!: Observable<ApplicationPageResult>
  private workspaces$!: Observable<WorkspacePageResult>
  public appSearchCriteriaGroup!: FormGroup<AppSearchCriteria>
  // dialog control
  public exceptionKey = ''
  public dataAccessIssue = false
  public loading = true
  public viewMode = 'grid'
  public appTypeItems: SelectItem[]
  public quickFilterValue: AppFilterType = 'ALL'
  public quickFilterItems: SelectItem[]
  public typeFilterValue$ = new BehaviorSubject<string | undefined>(undefined)
  public textFilterValue$ = new BehaviorSubject<string | undefined>(undefined)
  public sortField = 'appType'
  public sortOrder = -1
  public searchInProgress = false
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
    private appApi: ApplicationAPIService,
    private workspaceApi: WorkspaceAPIService,
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService
  ) {
    // search criteria
    this.appSearchCriteriaGroup = new FormGroup<AppSearchCriteria>({
      appId: new FormControl<string | null>(null),
      appType: new FormControl<AppFilterType | null>('WORKSPACE'),
      name: new FormControl<string | null>(null)
    })
    this.appSearchCriteriaGroup.controls['appType'].setValue('ALL') // default: all app types
    this.appSearchCriteriaGroup.controls['name'].disable()
    this.appTypeItems = [
      { label: 'DIALOG.SEARCH.FILTER.ALL', value: 'ALL' },
      { label: 'DIALOG.SEARCH.FILTER.APP', value: 'APP' },
      { label: 'DIALOG.SEARCH.FILTER.PRODUCT', value: 'PRODUCT' },
      { label: 'DIALOG.SEARCH.FILTER.WORKSPACE', value: 'WORKSPACE' }
    ]
    this.quickFilterItems = [
      { label: 'DIALOG.SEARCH.QUICK_FILTER.ALL', value: 'ALL' },
      { label: 'DIALOG.SEARCH.QUICK_FILTER.PRODUCT', value: 'PRODUCT' },
      { label: 'DIALOG.SEARCH.QUICK_FILTER.WORKSPACE', value: 'WORKSPACE' }
    ]
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
  }

  ngOnInit(): void {
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
          this.dataAccessIssue = true
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.WORKSPACE'
          console.error('getAllWorkspaceNames():', err)
          return of({} as WorkspacePageResult)
        }),
        finalize(() => (this.searchInProgress = false))
      )
    return this.workspaces$.pipe(
      map((result: any) => {
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
            searchAppType === 'PRODUCT' ? (this.appSearchCriteriaGroup.controls['name'].value ?? '') : undefined
        }
      })
      .pipe(
        catchError((err) => {
          this.dataAccessIssue = true
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.APPS'
          console.error('searchMicrofrontends():', err)
          return of({} as ApplicationPageResult)
        }),
        finalize(() => (this.searchInProgress = false))
      )
    return this.papps$.pipe(
      map((result: any) => {
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
    this.searchInProgress = true
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
    //return (a.displayName ?? '').toUpperCase().localeCompare((b.displayName ?? '').toUpperCase())
    return (
      a.appType.toUpperCase().localeCompare(b.appType.toUpperCase()) ||
      (a.displayName ?? '').toUpperCase().localeCompare((b.displayName ?? '').toUpperCase())
    )
  }

  /**
   * Dialog preparation
   */
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
        map((data: any) => {
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
  }

  /**
   * UI Events
   */
  public onAppClick(app: App): void {
    this.router.navigate(['./', app.appType.toLowerCase(), app.appType === 'PRODUCT' ? app.productName : app.appId], {
      relativeTo: this.route
    })
  }
  public onQuickFilterChange(ev: any): void {
    if (ev.value === 'ALL') {
      this.typeFilterValue$.next('')
    } else {
      if (ev.value) {
        this.typeFilterValue$.next(ev.value)
      }
    }
  }
  public onAppTypeFilterChange(ev: any): void {
    if (ev.value === 'ALL') this.appSearchCriteriaGroup.controls['name'].disable()
    else this.appSearchCriteriaGroup.controls['name'].enable()
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
}
