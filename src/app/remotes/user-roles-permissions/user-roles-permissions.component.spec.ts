import { ElementRef, NO_ERRORS_SCHEMA } from '@angular/core'
import { AsyncPipe, CommonModule } from '@angular/common'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { Table, TableModule } from 'primeng/table'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { Router } from '@angular/router'
import { of, ReplaySubject, throwError } from 'rxjs'

import { AppConfigService } from '@onecx/portal-integration-angular'
import { BASE_URL, RemoteComponentConfig } from '@onecx/angular-remote-components'

import { OneCXUserRolesPermissionsComponent } from './user-roles-permissions.component'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { AssignmentAPIService, UserAPIService, UserAssignment } from 'src/app/shared/generated'
import { provideHttpClient } from '@angular/common/http'

const userAssignments: UserAssignment[] = [
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

class MockTable {
  filterGlobal(value: string, mode: string) {}
}

describe('OneCXUserRolesPermissionsComponent', () => {
  let component: OneCXUserRolesPermissionsComponent
  let fixture: ComponentFixture<OneCXUserRolesPermissionsComponent>

  const userServiceSpy = {
    getUserAssignments: jasmine.createSpy('getUserAssignments').and.returnValue(of({ stream: userAssignments }))
  }
  const assgnmtApiSpy = {
    searchUserAssignments: jasmine.createSpy('searchUserAssignments').and.returnValue(of({ stream: userAssignments }))
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
          imports: [TranslateTestingModule, CommonModule, AsyncPipe],
          providers: [
            { provide: UserAPIService, useValue: userServiceSpy },
            { provide: AssignmentAPIService, useValue: assgnmtApiSpy },
            { provide: AppConfigService }
          ]
        }
      })
      .compileComponents()

    baseUrlSubject.next('base_url_mock')

    userServiceSpy.getUserAssignments.calls.reset()
    assgnmtApiSpy.searchUserAssignments.calls.reset()
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

  describe('initial load', () => {
    beforeEach(() => {
      initializeComponent()
    })

    it('should search user assignments', () => {
      spyOn(component, 'searchUserAssignments')

      component.onReload()

      expect(component.searchUserAssignments).toHaveBeenCalledWith()
    })
  })

  it('should apply global filter on the primeng table', () => {
    const mockTable: MockTable = TestBed.inject(Table) as unknown as MockTable
    const event = { target: { value: 'test' } } as unknown as Event
    spyOn(mockTable, 'filterGlobal')

    component.applyGlobalFilter(event, mockTable as unknown as Table)

    expect(mockTable.filterGlobal).toHaveBeenCalledWith('test', 'contains')
  })

  describe('searchUserAssignments', () => {
    beforeEach(() => {
      initializeComponent()
    })

    it('should get another users assignments', () => {
      assgnmtApiSpy.searchUserAssignments.and.returnValue(of(userAssignments))
      component.userId = 'id'

      component.ngOnChanges()

      component.userAssignments$.subscribe((assignments) => {
        expect(assignments).toEqual(assignments)
      })
    })

    it('should handle error when trying to get another users assignments', () => {
      const err = { error: 'error' }
      assgnmtApiSpy.searchUserAssignments.and.returnValue(throwError(() => err))
      spyOn(console, 'error')
      component.userId = 'id'

      component.ngOnChanges()

      component.userAssignments$.subscribe(() => {
        expect(console.error).toHaveBeenCalledWith('searchUserAssignments():', err)
      })
    })

    it('should get my user assignments', () => {
      userServiceSpy.getUserAssignments.and.returnValue(of(userAssignments))
      spyOn(console, 'error')

      component.ngOnChanges()

      component.userAssignments$.subscribe((assignments) => {
        expect(assignments).toEqual(assignments)
      })
    })

    it('should handle error when trying to get my user assignments', () => {
      const err = { error: 'error' }
      userServiceSpy.getUserAssignments.and.returnValue(throwError(() => err))
      spyOn(console, 'error')

      component.ngOnChanges()

      component.userAssignments$.subscribe(() => {
        expect(console.error).toHaveBeenCalledWith('getUserAssignments():', err)
      })
    })
  })

  describe('sortUserAssignments', () => {
    it('should sort by productName when different', () => {
      const a = { productName: 'Apple', resource: 'R1', action: 'A1', applicationId: 'id' }
      const b = { productName: 'Banana', resource: 'R1', action: 'A1', applicationId: 'id2' }
      expect(component['sortUserAssignments'](a, b)).toBeLessThan(0)
      expect(component['sortUserAssignments'](b, a)).toBeGreaterThan(0)
    })

    it('should be case-insensitive for productName', () => {
      const a = { productName: 'apple', resource: 'R1', action: 'A1' }
      const b = { productName: 'APPLE', resource: 'R1', action: 'A1' }
      expect(component['sortUserAssignments'](a, b)).toBe(0)
    })

    it('should sort by app id when productName is the same', () => {
      const a = { productName: 'Apple', resource: 'R1', action: 'A1', applicationId: 'id1' }
      const b = { productName: 'Apple', resource: 'R2', action: 'A2', applicationId: 'id2' }
      expect(component['sortUserAssignments'](a, b)).toBeLessThan(0)
      expect(component['sortUserAssignments'](b, a)).toBeGreaterThan(0)
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

  describe('extractFilterItems', () => {
    it('should return empty array when input array is empty', () => {
      const result = component.extractFilterItems([], 'productName')
      expect(result).toEqual([])
    })

    it('should extract unique product names and sort them', () => {
      const items: UserAssignment[] = [
        { productName: 'Product B', roleName: 'Role 1' },
        { productName: 'Product A', roleName: 'Role 2' },
        { productName: 'Product B', roleName: 'Role 3' },
        { productName: 'Product C', roleName: 'Role 4' }
      ]

      const result = component.extractFilterItems(items, 'productName')
      expect(result).toEqual(['Product A', 'Product B', 'Product C'])
    })

    it('should extract unique role names and sort them', () => {
      const items: UserAssignment[] = [
        { productName: 'Product 1', roleName: 'Role B' },
        { productName: 'Product 2', roleName: 'Role A' },
        { productName: 'Product 3', roleName: 'Role B' }
      ]

      const result = component.extractFilterItems(items, 'roleName')
      expect(result).toEqual(['Role A', 'Role B'])
    })

    it('should handle empty and undefined values', () => {
      const items: UserAssignment[] = [
        { productName: 'Product 1', roleName: '' },
        { productName: 'Product 2', roleName: undefined },
        { productName: 'Product 3', roleName: 'Role A' }
      ]

      const result = component.extractFilterItems(items, 'roleName')
      expect(result).toEqual(['Role A'])
    })

    it('should extract unique resources and sort them', () => {
      const items: UserAssignment[] = [
        { resource: 'Resource B', action: 'Action 1' },
        { resource: 'Resource A', action: 'Action 2' },
        { resource: 'Resource B', action: 'Action 3' }
      ]

      const result = component.extractFilterItems(items, 'resource')
      expect(result).toEqual(['Resource A', 'Resource B'])
    })

    it('should extract unique actions and sort them', () => {
      const items: UserAssignment[] = [
        { resource: 'Resource 1', action: 'Action B' },
        { resource: 'Resource 2', action: 'Action A' },
        { resource: 'Resource 3', action: 'Action B' }
      ]

      const result = component.extractFilterItems(items, 'action')
      expect(result).toEqual(['Action A', 'Action B'])
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

    it('should not throw an error if permissionTable is undefined', () => {
      component.permissionTable = undefined

      expect(() => component.onClearFilterUserAssignmentTable()).not.toThrow()
    })
  })
})
