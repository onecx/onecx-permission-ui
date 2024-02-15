import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { HttpErrorResponse } from '@angular/common/http'
import { ActivatedRoute, Router } from '@angular/router'
import { Observable, Subject, catchError, forkJoin, of, takeUntil } from 'rxjs'
import { TranslateService } from '@ngx-translate/core'
import { SelectItem } from 'primeng/api'
import { DataView } from 'primeng/dataview'

import {
  Action,
  DataViewControlTranslations,
  PortalApiService,
  Portal,
  MicrofrontendRegistration,
  PortalMessageService,
} from '@onecx/portal-integration-angular'
import { limitText } from '../shared/utils'

import { ApplicationsRestControllerAPIService, RolesRestControllerAPIService } from '../generated/api/api'
import {
  ApplicationAbstractDTO,
  ApplicationCreateRequestDTO,
  ApplicationTypeDTO1,
  CreateRoleDTO,
} from '../generated/model/models'

type TypedApplication = ApplicationAbstractDTO & { existsInApm: boolean; portalExists: boolean }

@Component({
  templateUrl: './application-search.component.html',
  styleUrls: ['./application-search.component.scss'],
})
export class ApplicationSearchComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject()
  private readonly debug = true // to be removed after finalization
  // dialog control
  public loading = true
  public breadcrumbItems = [{}]
  public actions: Action[] = []
  public dataAccessIssue = false
  public exceptionKey = ''

  // data
  public dataViewControlsTranslations: DataViewControlTranslations = {}
  @ViewChild(DataView) dv: DataView | undefined
  private apps$!: Observable<ApplicationAbstractDTO[]>
  private portals$!: Observable<Portal[]>
  private portals: Map<string, Portal> = new Map()
  private regMfes: Map<string, MicrofrontendRegistration> = new Map()
  public apps!: TypedApplication[]
  public viewMode = 'grid'
  public quickFilterValue = 'ALL' || 'WORKSPACE' || 'APP'
  public quickFilterItems: SelectItem[]
  public filterValue: string | undefined
  public filterBy = 'id,applicationType' || 'applicationType'
  public sortField = 'id' || 'applicationType'
  public sortOrder = 1
  public limitText = limitText

  constructor(
    private appApi: ApplicationsRestControllerAPIService,
    private roleApi: RolesRestControllerAPIService,
    private portalApi: PortalApiService,
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
    private msgService: PortalMessageService
  ) {
    this.quickFilterItems = [
      { label: 'APPLICATION.SEARCH.FILTER.ALL', value: 'ALL' },
      { label: 'APPLICATION.SEARCH.FILTER.APP', value: 'APP' },
      { label: 'APPLICATION.SEARCH.FILTER.WORKSPACE', value: 'WORKSPACE' },
    ]
  }

  ngOnInit(): void {
    this.translate.get(['APPLICATION.GOTO_OVERVIEW', 'APPLICATION.GOTO_OVERVIEW.TOOLTIP']).subscribe((data) => {
      this.prepareActionButtons(data)
    })
    this.translate
      .get([
        'ACTIONS.SEARCH.SORT_BY',
        'ACTIONS.SEARCH.FILTER',
        'ACTIONS.SEARCH.FILTER_OF',
        'APPLICATION.ID',
        'APPLICATION.TYPE',
        'ACTIONS.SEARCH.SORT_DIRECTION_ASC',
        'ACTIONS.SEARCH.SORT_DIRECTION_DESC',
      ])
      .subscribe((data) => {
        this.prepareTranslations(data)
      })
    this.loadData()
  }
  public ngOnDestroy(): void {
    this.destroy$.next(undefined)
    this.destroy$.complete()
  }
  private log(text: string, obj?: object): void {
    if (this.debug) console.log(text, obj)
  }

  private prepareActionButtons(data: any): void {
    this.actions.push({
      label: data['APPLICATION.GOTO_OVERVIEW'],
      title: data['APPLICATION.GOTO_OVERVIEW.TOOLTIP'],
      actionCallback: () => this.gotoOverviewDialog(),
      icon: 'pi pi-wrench',
      show: 'always',
    })
  }
  private prepareTranslations(data: any): void {
    this.dataViewControlsTranslations = {
      sortDropdownPlaceholder: data['ACTIONS.SEARCH.SORT_BY'],
      filterInputPlaceholder: data['ACTIONS.SEARCH.FILTER'],
      filterInputTooltip: data['ACTIONS.SEARCH.FILTER_OF'] + data['APPLICATION.ID'] + ', ' + data['APPLICATION.TYPE'],
      sortOrderTooltips: {
        ascending: data['ACTIONS.SEARCH.SORT_DIRECTION_ASC'],
        descending: data['ACTIONS.SEARCH.SORT_DIRECTION_DESC'],
      },
      sortDropdownTooltip: data['ACTIONS.SEARCH.SORT_BY'],
    }
  }

  public gotoOverviewDialog(): void {
    this.router.navigate(['overview'], { relativeTo: this.route })
  }

  public onQuickFilterChange(ev: any): void {
    if (ev.value === 'ALL') {
      this.filterBy = 'id,applicationType'
      this.filterValue = ''
      this.dv?.filter(this.filterValue, 'contains')
    } else {
      this.filterBy = 'applicationType'
      if (ev.value) {
        this.filterValue = ev.value
        this.dv?.filter(ev.value, 'equals')
      }
    }
  }
  public onFilterChange(filter: string): void {
    if (filter === '') {
      this.filterBy = 'id,applicationType'
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
  public onAppClick(ev: any, app: TypedApplication): void {
    if (app.applicationType === 'APP' || (app.applicationType === 'WORKSPACE' && app.existsInApm))
      this.router.navigate(['./', app.id], { relativeTo: this.route })
  }

  /**
   * Getting all the data at once
   */
  public loadData(): void {
    this.loading = true
    this.dataAccessIssue = false
    this.exceptionKey = ''
    // prepare requests and catching errors
    this.portals$ = this.portalApi.getAllPortals().pipe(catchError((error) => of(error)))
    this.apps$ = this.appApi.getAllApplicationAbstracts({}).pipe(catchError((error) => of(error)))
    // get data and process
    forkJoin([this.portals$, this.apps$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([portals, apps]) => {
        // First: check for errors
        if (portals instanceof HttpErrorResponse) {
          this.dataAccessIssue = true
          this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + portals.status + '.WORKSPACES'
          console.error('getAllPortals():', portals)
        } else if (portals instanceof Array) {
          this.portals = new Map(portals.map((p) => [p.portalName, p]))
          this.log('getAllPortals():', this.portals)
          // prepare a consolidated map of any registered MFEs
          portals.forEach((p) => {
            p.microfrontendRegistrations.forEach((m) =>
              !this.regMfes.has(m.mfeId) ? this.regMfes.set(m.mfeId, m) : null
            )
          })
          this.log('registered MFEs:', this.regMfes)
        } else console.error('getAllPortals() => unknown response:', portals)
        if (!this.dataAccessIssue) {
          // First: check for errors
          if (apps instanceof HttpErrorResponse) {
            this.dataAccessIssue = true
            this.exceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + apps.status + '.APPLICATIONS'
            console.error('getAllApplications():', apps)
          } else if (apps instanceof Array) {
            // prepare APM apps: if app is portal then check existence in portals
            if (apps.length > 0)
              this.apps = apps.map((app) => {
                return {
                  id: app.id,
                  description: app.description,
                  applicationType: app.applicationType ? app.applicationType : ApplicationTypeDTO1.App,
                  existsInApm: true,
                  portalExists: this.portals.has(app.id || '') ? true : false,
                } as TypedApplication
              })
            // add portals as preliminary APM app which are not in APM
            portals.forEach((p) => {
              if (this.apps.filter((a) => a.id === p.portalName).length === 0)
                this.apps.push({
                  id: p.portalName,
                  description: p.description,
                  applicationType: ApplicationTypeDTO1.Workspace,
                  existsInApm: false,
                  portalExists: true,
                } as TypedApplication)
            })
            this.apps.sort(this.sortTypedApplicationById)
            this.log('getAllApplications():', this.apps)
          } else console.error('getAllApplications() => unknown response:', apps)
        }
        this.loading = false
      })
  }
  private sortTypedApplicationById(a: TypedApplication, b: TypedApplication): number {
    return (a.id ? (a.id as string).toUpperCase() : '').localeCompare(b.id ? (b.id as string).toUpperCase() : '')
  }

  /**
   * Manage portals in APM:
   *   1. delete non-existing portals in APM
   *   2. add portals which are not exists in APM
   */
  public onUnRegisterPortalInApm(ev: any, app: TypedApplication): void {
    ev.stopPropagation()
    if (app.id)
      this.appApi.deleteApplication({ applicationId: app.id }).subscribe({
        next: () => {
          this.apps = this.apps.filter((a) => a.id !== app.id)
          this.msgService.success({ summaryKey: 'ACTIONS.DELETE.MESSAGE.APPLICATION_OK' })
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'ACTIONS.DELETE.MESSAGE.APPLICATION_NOK' })
          console.error(err.error)
        },
      })
  }
  public onRegisterPortalInApm(ev: any, app: TypedApplication): void {
    ev.stopPropagation()
    this.appApi
      .createApplication({
        applicationCreateRequestDTO: {
          createApplicationDTO: {
            id: app.id,
            description: app.description,
            applicationType: app.applicationType,
          },
        } as ApplicationCreateRequestDTO,
      })
      .subscribe({
        next: (data) => {
          if (data.applicationAbstractDTO.id) {
            this.msgService.success({ summaryKey: 'ACTIONS.CREATE.MESSAGE.APPLICATION_OK' })
            app.existsInApm = true
            const p = this.portals.get(data?.applicationAbstractDTO.id)
            if (p?.portalRoles)
              // create portal roles
              p.portalRoles.forEach((r, i) => {
                this.roleApi
                  .createRoleForApp({
                    applicationId: app.id ? app.id : '',
                    createRoleDTO: { name: r, id: app.id } as CreateRoleDTO,
                  })
                  .subscribe({
                    next: () => {
                      if (p.portalRoles && i === p.portalRoles.length - 1)
                        this.router.navigate(['./', app.id], { relativeTo: this.route })
                      // TODO: go to specific portal detail
                    },
                    error: (err) => {
                      this.msgService.error({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_NOK' })
                      console.error(err.error)
                    },
                  })
              })
          }
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'ACTIONS.CREATE.MESSAGE.APPLICATION_NOK' })
          console.error(err.error)
        },
      })
  }
}
