import { ElementRef, NO_ERRORS_SCHEMA } from '@angular/core'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { Table, TableModule } from 'primeng/table'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { Router } from '@angular/router'
import { of, ReplaySubject, throwError } from 'rxjs'

import { AppConfigService } from '@onecx/portal-integration-angular'
import { BASE_URL, RemoteComponentConfig } from '@onecx/angular-remote-components'

import { OneCXUserRolesPermissionsComponent } from './user-roles-permissions.component'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { RoleAPIService, UserAPIService, UserAssignment } from 'src/app/shared/generated'
import { provideHttpClient } from '@angular/common/http'

const userAssgnmnts: UserAssignment[] = [
  {
    roleName: 'role1',
    productName: 'prod1',
    applicationId: 'ocx-app1',
    resource: 'resource1'
  },
  {
    roleName: 'role2',
    productName: 'prod2',
    applicationId: 'ocx-app2',
    resource: 'resource2'
  }
]

const roles = ['role1', 'role2']

class MockTable {
  filterGlobal(value: string, mode: string) {}
}

describe('OneCXUserRolesPermissionsComponent', () => {
  let component: OneCXUserRolesPermissionsComponent
  let fixture: ComponentFixture<OneCXUserRolesPermissionsComponent>

  const userServiceSpy = {
    getUserAssignments: jasmine.createSpy('getUserAssignments').and.returnValue(of({ stream: userAssgnmnts }))
  }
  const roleServiceSpy = {
    searchRoles: jasmine.createSpy('searhRoles').and.returnValue(of({ stream: roles }))
  }

  const routerMock = jasmine.createSpyObj<Router>('Router', ['navigateByUrl'])
  let baseUrlSubject: ReplaySubject<any>

  beforeEach(waitForAsync(() => {
    baseUrlSubject = new ReplaySubject<any>(1)

    TestBed.configureTestingModule({
      declarations: [],
      imports: [
        TableModule,
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: UserAPIService, useValue: userServiceSpy },
        { provide: RoleAPIService, useValue: roleServiceSpy },
        { provide: Router, useValue: routerMock },
        { provide: Table, useClass: MockTable },
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: BASE_URL,
          useValue: baseUrlSubject
        }
      ]
    })
      .overrideComponent(OneCXUserRolesPermissionsComponent, {
        set: {
          imports: [TranslateTestingModule],
          providers: [
            { provide: UserAPIService, useValue: userServiceSpy },
            { provide: RoleAPIService, useValue: roleServiceSpy },
            { provide: AppConfigService }
          ]
        }
      })
      .compileComponents()

    baseUrlSubject.next('base_url_mock')

    userServiceSpy.getUserAssignments.calls.reset()
    roleServiceSpy.searchRoles.calls.reset()
    routerMock.navigateByUrl.calls.reset()
  }))

  function initializeComponent() {
    fixture = TestBed.createComponent(OneCXUserRolesPermissionsComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  }

  it('should create with correct data', () => {
    initializeComponent()
    expect(component).toBeTruthy()
  })

  describe('RemoteComponent initialization', () => {
    it('should call ocxInitRemoteComponent with the correct config', () => {
      const mockConfig: RemoteComponentConfig = {
        appId: 'appId',
        productName: 'prodName',
        permissions: ['permission'],
        baseUrl: 'base'
      }
      spyOn(component, 'ocxInitRemoteComponent')

      component.ocxRemoteComponentConfig = mockConfig

      expect(component.ocxInitRemoteComponent).toHaveBeenCalledWith(mockConfig)
    })

    it('should initialize the remote component', (done: DoneFn) => {
      initializeComponent()

      component.ocxInitRemoteComponent({
        baseUrl: 'base_url'
      } as RemoteComponentConfig)

      baseUrlSubject.asObservable().subscribe((item) => {
        expect(item).toEqual('base_url')
        done()
      })
    })
  })

  describe('loadData', () => {
    beforeEach(() => {
      initializeComponent()
    })

    it('should display errors if api calls fail', () => {
      const err = { status: '404' }
      userServiceSpy.getUserAssignments.and.returnValue(throwError(() => err))
      roleServiceSpy.searchRoles.and.returnValue(throwError(() => err))
      spyOn(console, 'error')

      component.loadData()

      expect(console.error).toHaveBeenCalledWith('searchAssignments():', err)
      expect(console.error).toHaveBeenCalledWith('searchRoles():', err)
    })
  })

  it('should apply global filter on the primeng table', () => {
    const mockTable: MockTable = TestBed.inject(Table) as unknown as MockTable
    const event = { target: { value: 'test' } } as unknown as Event
    spyOn(mockTable, 'filterGlobal')

    component.applyGlobalFilter(event, mockTable as unknown as Table)

    expect(mockTable.filterGlobal).toHaveBeenCalledWith('test', 'contains')
  })

  it('should clear userAssignmentItems and roles, and reload the data on onReload', () => {
    spyOn(component, 'loadData')

    component.userAssignmentItems = userAssgnmnts
    component.roles = roles

    component.onReload()

    expect(component.userAssignmentItems).toEqual([])
    expect(component.roles).toEqual([])
    expect(component.loadData).toHaveBeenCalled()
  })

  describe('sortUserAssignments', () => {
    it('should sort by productName when different', () => {
      const a = { productName: 'Apple', resource: 'R1', action: 'A1' }
      const b = { productName: 'Banana', resource: 'R1', action: 'A1' }
      expect(component['sortUserAssignments'](a, b)).toBeLessThan(0)
      expect(component['sortUserAssignments'](b, a)).toBeGreaterThan(0)
    })

    it('should be case-insensitive for productName', () => {
      const a = { productName: 'apple', resource: 'R1', action: 'A1' }
      const b = { productName: 'APPLE', resource: 'R1', action: 'A1' }
      expect(component['sortUserAssignments'](a, b)).toBe(0)
    })

    it('should sort by resource when productName is the same', () => {
      const a = { productName: 'Apple', resource: 'R1', action: 'A1' }
      const b = { productName: 'Apple', resource: 'R2', action: 'A1' }
      expect(component['sortUserAssignments'](a, b)).toBeLessThan(0)
      expect(component['sortUserAssignments'](b, a)).toBeGreaterThan(0)
    })

    it('should be case-insensitive for resource', () => {
      const a = { productName: 'Apple', resource: 'r1', action: 'A1' }
      const b = { productName: 'Apple', resource: 'R1', action: 'A1' }
      expect(component['sortUserAssignments'](a, b)).toBe(0)
    })

    it('should sort by action when productName and resource are the same', () => {
      const a = { productName: 'Apple', resource: 'R1', action: 'A1' }
      const b = { productName: 'Apple', resource: 'R1', action: 'A2' }
      expect(component['sortUserAssignments'](a, b)).toBeLessThan(0)
      expect(component['sortUserAssignments'](b, a)).toBeGreaterThan(0)
    })

    it('should be case-insensitive for action', () => {
      const a = { productName: 'Apple', resource: 'R1', action: 'a1' }
      const b = { productName: 'Apple', resource: 'R1', action: 'A1' }
      expect(component['sortUserAssignments'](a, b)).toBe(0)
    })

    it('should handle undefined values', () => {
      const a = { productName: undefined, resource: undefined, action: undefined }
      const b = { productName: 'Apple', resource: 'R1', action: 'A1' }
      expect(component['sortUserAssignments'](a, b)).toBeLessThan(0)
      expect(component['sortUserAssignments'](b, a)).toBeGreaterThan(0)
    })

    it('should treat undefined as empty string', () => {
      const a = { productName: '', resource: '', action: '' }
      const b = { productName: undefined, resource: undefined, action: undefined }
      expect(component['sortUserAssignments'](a, b)).toBe(0)
    })
  })

  describe('onClearFilterUserAssignmentTable', () => {
    it('should clear the permissionTableFilter value if it exists', () => {
      component.permissionTableFilter = {
        nativeElement: { value: 'test filter' }
      } as ElementRef

      component.onClearFilterUserAssignmentTable()

      expect(component.permissionTableFilter?.nativeElement.value).toBe('')
    })

    it('should not throw an error if permissionTableFilter is undefined', () => {
      component.permissionTableFilter = undefined

      expect(() => component.onClearFilterUserAssignmentTable()).not.toThrow()
    })

    it('should call clear() on permissionTable if it exists', () => {
      component.permissionTable = jasmine.createSpyObj('permissionTable', ['clear'])

      component.onClearFilterUserAssignmentTable()

      expect(component.permissionTable?.clear).toHaveBeenCalled()
    })

    it('should not throw an error if permissionTable is undefined', () => {
      component.permissionTable = undefined

      expect(() => component.onClearFilterUserAssignmentTable()).not.toThrow()
    })

    it('should call loadData()', () => {
      spyOn(component, 'loadData')

      component.onClearFilterUserAssignmentTable()

      expect(component.loadData).toHaveBeenCalled()
    })
  })
})
