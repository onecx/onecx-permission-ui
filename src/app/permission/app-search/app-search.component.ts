import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { HttpErrorResponse } from '@angular/common/http'
import { ActivatedRoute, Router } from '@angular/router'
import { Observable, Subject, catchError, forkJoin, map, of, takeUntil } from 'rxjs'
import { TranslateService } from '@ngx-translate/core'
import { SelectItem } from 'primeng/api'
import { DataView } from 'primeng/dataview'

import { DataViewControlTranslations, PortalMessageService } from '@onecx/portal-integration-angular'
import { limitText } from 'src/app/shared/utils'

import {
  Application,
  ApplicationAPIService,
  AssignmentAPIService,
  PermissionAPIService,
  RoleAPIService,
  WorkspaceAPIService,
  ApplicationPageResult
} from 'src/app/shared/generated'

export type App = Application & { isApp: boolean; type: AppType }
export type AppType = 'WORKSPACE' | 'APP'
export type AppFilterType = 'ALL' | 'WORKSPACE' | 'APP'

@Component({
  templateUrl: './app-search.component.html',
  styleUrls: ['./app-search.component.scss']
})
export class AppSearchComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject()
  private readonly debug = true // to be removed after finalization
  // dialog control
  public loading = true
  public breadcrumbItems = [{}]
  public dataAccessIssue = false
  public exceptionKey = ''

  // data
  public dataViewControlsTranslations: DataViewControlTranslations = {}
  @ViewChild(DataView) dv: DataView | undefined
  private apps$!: Observable<ApplicationPageResult>
  private papps$!: Observable<App[]>
  private workspaces$!: Observable<string[]>
  public apps: App[] = []
  public viewMode = 'grid'
  public quickFilterValue: AppFilterType = 'ALL'
  public quickFilterItems: SelectItem[]
  public filterValue: string | undefined
  public filterBy = 'name,type' || 'type'
  public sortField = 'name' || 'type'
  public sortOrder = 1
  public limitText = limitText

  constructor(
    private appApi: ApplicationAPIService,
    private assApi: AssignmentAPIService,
    private permApi: PermissionAPIService,
    private roleApi: RoleAPIService,
    private workspaceApi: WorkspaceAPIService,
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private msgService: PortalMessageService
  ) {
    this.quickFilterItems = [
      { label: 'APP.SEARCH.QUICK_FILTER.ALL', value: 'ALL' },
      { label: 'APP.SEARCH.QUICK_FILTER.APP', value: 'APP' },
      { label: 'APP.SEARCH.QUICK_FILTER.WORKSPACE', value: 'WORKSPACE' }
    ]
  }

  ngOnInit(): void {
    this.prepareTranslations()
    this.loadData()
  }
  public ngOnDestroy(): void {
    this.destroy$.next(undefined)
    this.destroy$.complete()
  }
  private log(text: string, obj?: object): void {
    if (this.debug) {
      if (obj) console.log('app detail: ' + text, obj)
      else console.log('app detail: ' + text)
    }
  }

  /**
   * Getting all the data at once
   */
  public loadData(): void {
    this.apps = []
    this.loading = true
    this.dataAccessIssue = false
    this.exceptionKey = ''
    // prepare requests and catching errors
    this.workspaces$ = this.workspaceApi.getAllWorkspaceNames().pipe(catchError((error) => of(error)))
    this.apps$ = this.appApi
      .searchApplications({
        applicationSearchCriteria: { pageSize: 1000 }
      })
      .pipe(catchError((error) => of(error)))
    // get data and combine
    forkJoin([this.workspaces$, this.apps$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([workspaces, apps]) => {
        // workspaces
        if (workspaces instanceof HttpErrorResponse) {
          this.dataAccessIssue = true
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + workspaces.status + '.WORKSPACES'
          console.error('getAllWorkspaceNames():', workspaces)
        } else if (workspaces instanceof Array) {
          for (let w of workspaces) {
            this.apps.push({ appId: w, name: w, isApp: false, type: 'WORKSPACE' } as App)
          }
          this.apps.sort(this.sortAppsByAppId)
          this.log('loadData() workspaces:', this.apps)
        } else console.error('getAllWorkspaceNames() => unknown response:', workspaces)

        // apps
        if (!this.dataAccessIssue) {
          if (apps instanceof HttpErrorResponse) {
            this.dataAccessIssue = true
            this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + apps.status + '.APPS'
            console.error('searchApplications():', apps)
          } else if (apps.stream instanceof Array) {
            for (const app of apps.stream) {
              this.apps.push({ ...app, isApp: true, type: 'APP' } as App)
            }
            this.apps.sort(this.sortAppsByAppId)
            this.log('loadData() apps:', this.apps)
            //this.prepareTranslations()
          } else console.error('searchApplications() => unknown response:', apps)
        }
        this.loading = false
      })
  }
  private sortAppsByAppId(a: App, b: App): number {
    return (a.appId ? (a.appId as string).toUpperCase() : '').localeCompare(
      b.appId ? (b.appId as string).toUpperCase() : ''
    )
  }

  /**
   * Dialog preparation
   */
  private prepareTranslations(): void {
    this.translate
      .get([
        'APP.NAME',
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
            filterInputTooltip: data['ACTIONS.SEARCH.FILTER.OF'] + data['APP.NAME'] + ', ' + data['APP.TYPE'],
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
    this.router.navigate(['./', app.type.toLowerCase(), app.appId], { relativeTo: this.route })
  }
  public onQuickFilterChange(ev: any): void {
    this.log('onQuickFilterChange ')
    if (ev.value === 'ALL') {
      this.filterBy = 'id,type'
      this.filterValue = ''
      this.dv?.filter(this.filterValue, 'contains')
    } else {
      this.filterBy = 'type'
      if (ev.value) {
        this.filterValue = ev.value
        this.dv?.filter(ev.value, 'equals')
      }
    }
  }
  public onFilterChange(filter: string): void {
    this.log('onFilterChange')
    if (filter === '') {
      this.filterBy = 'id,type'
      this.quickFilterValue = 'ALL'
    }
    this.dv?.filter(filter, 'contains')
  }

  public onSortChange(field: string): void {
    this.sortField = field
  }
  public onSortDirChange(asc: boolean): void {
    this.sortOrder = asc ? -1 : 1
  }
}
