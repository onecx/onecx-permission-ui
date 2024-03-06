import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { FormControl, FormGroup } from '@angular/forms'
import { combineLatest, finalize, map, of, Observable, Subject, catchError } from 'rxjs'
import { TranslateService } from '@ngx-translate/core'
import { SelectItem } from 'primeng/api'
import { DataView } from 'primeng/dataview'

import { DataViewControlTranslations } from '@onecx/portal-integration-angular'
import { limitText } from 'src/app/shared/utils'

import {
  Application,
  ApplicationAPIService,
  WorkspaceAPIService,
  WorkspacePageResult,
  ApplicationPageResult
} from 'src/app/shared/generated'

export interface AppSearchCriteria {
  appId: FormControl<string | null>
  appType: FormControl<AppFilterType | null>
}
export type App = Application & { isApp: boolean; appType: AppType }
export type AppType = 'WORKSPACE' | 'APP'
export type AppFilterType = 'ALL' | AppType

@Component({
  templateUrl: './app-search.component.html',
  styleUrls: ['./app-search.component.scss']
})
export class AppSearchComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject()
  // data
  public apps$!: Observable<App[]>
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
  public filterValue: string | undefined
  public filterValueDefault = 'appId,appType'
  public filterBy = this.filterValueDefault || 'appType'
  public filter: string | undefined
  public sortField = 'appId' || 'appType'
  public sortOrder = 1
  public searchInProgress = false
  public limitText = limitText

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
      appType: new FormControl<AppFilterType | null>('WORKSPACE')
    })
    this.appSearchCriteriaGroup.controls['appType'].setValue('ALL') // default: all app types
    this.appTypeItems = [
      { label: 'APP.SEARCH.FILTER.ALL', value: 'ALL' },
      { label: 'APP.SEARCH.FILTER.WORKSPACE', value: 'WORKSPACE' },
      { label: 'APP.SEARCH.FILTER.APP', value: 'APP' }
    ]
    this.quickFilterItems = [
      { label: 'APP.SEARCH.QUICK_FILTER.ALL', value: 'ALL' },
      { label: 'APP.SEARCH.QUICK_FILTER.WORKSPACE', value: 'WORKSPACE' },
      { label: 'APP.SEARCH.QUICK_FILTER.APP', value: 'APP' }
    ]
  }

  ngOnInit(): void {
    this.prepareDialogTranslations()
    this.declarePermissionAppObservable()
    this.searchApps()
  }
  public ngOnDestroy(): void {
    this.destroy$.next(undefined)
    this.destroy$.complete()
  }

  /**
   * DECLARE Observables
   */
  private declareWorkspaceObservable(): void {
    this.workspaces$ = this.workspaceApi.searchWorkspaces({ workspaceSearchCriteria: {} }).pipe(
      catchError((err) => {
        this.dataAccessIssue = true
        this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.WORKSPACES'
        console.error('getAllWorkspaceNames():', err)
        return of({} as WorkspacePageResult)
      }),
      finalize(() => (this.searchInProgress = false))
    )
  }
  private declarePermissionAppObservable(): void {
    this.papps$ = this.appApi
      .searchApplications({
        applicationSearchCriteria: {
          appId: this.appSearchCriteriaGroup.controls['appId'].value ?? '',
          pageSize: 100
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
  }

  /**
   * SEARCH
   */
  private searchWorkspaces(): Observable<App[]> {
    this.declareWorkspaceObservable()
    return this.workspaces$.pipe(
      map((result) => {
        return result.stream
          ? result.stream
              ?.map((w) => {
                return { appId: w.name, appType: 'WORKSPACE', description: w.description } as App
              })
              .sort(this.sortAppsByAppId)
          : []
      })
    )
  }
  private searchPermissionApps(): Observable<App[]> {
    return this.papps$.pipe(
      map((result) => {
        return result.stream
          ? result.stream
              ?.map((app) => {
                return { ...app, appType: 'APP' } as App
              })
              .sort(this.sortAppsByAppId)
          : []
      })
    )
  }
  public searchApps(): void {
    this.searchInProgress = true
    switch (this.appSearchCriteriaGroup.controls['appType'].value) {
      case 'ALL':
        this.apps$ = combineLatest([this.searchWorkspaces(), this.searchPermissionApps()]).pipe(
          map(([w, a]) => w.concat(a).sort(this.sortAppsByAppId))
        )
        break
      case 'WORKSPACE':
        this.apps$ = this.searchWorkspaces()
        break
      case 'APP':
        this.apps$ = this.searchPermissionApps()
        break
    }
  }
  private sortAppsByAppId(a: App, b: App): number {
    return (a.appId ? (a.appId as string).toUpperCase() : '').localeCompare(
      b.appId ? (b.appId as string).toUpperCase() : ''
    )
  }

  /**
   * Dialog preparation
   */
  private prepareDialogTranslations(): void {
    this.translate
      .get([
        'APP.ID',
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
            filterInputTooltip: data['ACTIONS.SEARCH.FILTER.OF'] + data['APP.ID'] + ', ' + data['APP.TYPE'],
            sortOrderTooltips: {
              ascending: data['ACTIONS.SEARCH.SORT_DIRECTION_ASC'],
              descending: data['ACTIONS.SEARCH.SORT_DIRECTION_DESC']
            },
            sortDropdownTooltip: data['ACTIONS.SEARCH.SORT_BY']
          }
        })
      )
  }

  /**
   * UI Events
   */
  public onAppClick(ev: any, app: App): void {
    this.router.navigate(['./', app.appType.toLowerCase(), app.appId], { relativeTo: this.route })
  }
  public onQuickFilterChange(ev: any): void {
    if (ev.value === 'ALL') {
      this.filterBy = this.filterValueDefault
      this.filterValue = ''
      this.dv?.filter(this.filterValue, 'contains')
    } else {
      this.filterBy = 'appType'
      if (ev.value) {
        this.filterValue = ev.value
        this.dv?.filter(ev.value, 'equals')
      }
    }
  }
  public onFilterChange(filter: string): void {
    this.filter = filter
    this.dv?.filter(filter, 'contains')
  }
  public onSortChange(field: string): void {
    this.sortField = field
  }
  public onSortDirChange(asc: boolean): void {
    this.sortOrder = asc ? -1 : 1
  }
  public onSearch() {
    this.searchApps()
  }
  public onSearchReset() {
    this.appSearchCriteriaGroup.reset({ appType: 'ALL' })
    this.apps$ = of([] as App[])
  }
}
