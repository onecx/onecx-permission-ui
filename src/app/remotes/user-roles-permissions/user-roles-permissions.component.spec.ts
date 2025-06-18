import { ElementRef } from '@angular/core'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { AsyncPipe, CommonModule } from '@angular/common'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { Router } from '@angular/router'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, ReplaySubject, throwError } from 'rxjs'
import { Table, TableModule } from 'primeng/table'

import { BASE_URL, RemoteComponentConfig, SlotService } from '@onecx/angular-remote-components'
import { AppConfigService } from '@onecx/angular-integration-interface'

import { AssignmentAPIService, UserAPIService, UserAssignment } from 'src/app/shared/generated'
import {
  OneCXUserRolesPermissionsComponent,
  ExtendedSelectItem,
  slotInitializer
} from './user-roles-permissions.component'

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

  const userApiSpy = {
    getUserAssignments: jasmine.createSpy('getUserAssignments').and.returnValue(of({ stream: userAssignments })),
    getTokenRoles: jasmine.createSpy('getTokenRoles').and.returnValue(of([]))
  }
  const assApiSpy = {
    searchUserAssignments: jasmine.createSpy('searchUserAssignments').and.returnValue(of({ stream: userAssignments }))
  }
  const slotServiceSpy = {
    isSomeComponentDefinedForSlot: jasmine.createSpy('isSomeComponentDefinedForSlot').and.returnValue(of(false))
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
      providers: [
        { provide: SlotService, useValue: slotServiceSpy },
        { provide: UserAPIService, useValue: userApiSpy },
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
            { provide: UserAPIService, useValue: userApiSpy },
            { provide: AssignmentAPIService, useValue: assApiSpy },
            { provide: AppConfigService }
          ]
        }
      })
      .compileComponents()

    baseUrlSubject.next('base_url_mock')

    slotServiceSpy.isSomeComponentDefinedForSlot.calls.reset()
    userApiSpy.getUserAssignments.calls.reset()
    assApiSpy.searchUserAssignments.calls.reset()
    routerMock.navigateByUrl.calls.reset()
  }))

  function initializeComponent(id?: string, issuer?: string) {
    fixture = TestBed.createComponent(OneCXUserRolesPermissionsComponent)
    component = fixture.componentInstance
    component.active = true
    component.userId = id
    component.issuer = issuer
    fixture.detectChanges()
    component.roleListEmitter.emit([{ name: 'role1' }, { name: 'role2' }])
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
      initializeComponent('userid')

      component.ocxInitRemoteComponent({
        baseUrl: 'base_url'
      } as RemoteComponentConfig)

      baseUrlSubject.asObservable().subscribe((item) => {
        expect(item).toEqual('base_url')
        done()
      })
    })
  })

  describe('slotInitializer', () => {
    let slotService: jasmine.SpyObj<SlotService>

    beforeEach(() => {
      slotService = jasmine.createSpyObj('SlotService', ['init'])
    })

    it('should call SlotService.init', () => {
      const initializer = slotInitializer(slotService)
      initializer()

      expect(slotService.init).toHaveBeenCalled()
    })
  })

  describe('initial load', () => {
    beforeEach(() => {
      initializeComponent('userid', 'issuer')
    })

    it('should search user assignments on reload', () => {
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

  describe('search user assignments', () => {
    beforeEach(() => {
      initializeComponent('userid', 'issuer')
    })

    it('should get another users assignments', () => {
      assApiSpy.searchUserAssignments.and.returnValue(of(userAssignments))

      component.ngOnChanges()

      component.userAssignments$.subscribe((assignments) => {
        expect(assignments).toEqual(assignments)
      })
    })

    it('should handle error when trying to get another users assignments', () => {
      const errorResponse = { error: 'error', status: 403, statusText: 'No permissions' }
      assApiSpy.searchUserAssignments.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')

      component.ngOnChanges()

      component.userAssignments$.subscribe(() => {
        expect(console.error).toHaveBeenCalledWith('searchUserAssignments', errorResponse)
        expect(component.exceptionKey).toEqual('EXCEPTIONS.HTTP_STATUS_' + errorResponse.status + '.PERMISSIONS')
      })
    })

    it('should handle error when user not longer exist in IAM', () => {
      const errorResponse = {
        error: { errorCode: '400', detail: 'USER_NOT_FOUND' },
        status: 400,
        statusText: 'User does not exist'
      }
      assApiSpy.searchUserAssignments.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')

      component.ngOnChanges()

      component.userAssignments$.subscribe(() => {
        expect(console.error).toHaveBeenCalledWith('searchUserAssignments', errorResponse)
        expect(component.exceptionKey).toEqual('EXCEPTIONS.NOT_FOUND.USER')
      })
    })
  })

  describe('search my user assignments', () => {
    beforeEach(() => {
      initializeComponent()
    })

    it('should get my user assignments', () => {
      userApiSpy.getUserAssignments.and.returnValue(of(userAssignments))
      spyOn(console, 'error')

      component.ngOnChanges()

      component.userAssignments$.subscribe((assignments) => {
        expect(assignments).toEqual(assignments)
      })
    })

    it('should handle error when trying to get my user assignments', () => {
      const err = { error: 'error' }
      userApiSpy.getUserAssignments.and.returnValue(throwError(() => err))
      spyOn(console, 'error')

      component.ngOnChanges()

      component.userAssignments$.subscribe(() => {
        expect(console.error).toHaveBeenCalledWith('getUserAssignments', err)
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

  describe('idm roles', () => {
    it('should getting my idm roles from token - successful', (done) => {
      initializeComponent()

      component.ngOnChanges()

      component.loadingIdmRoles = false
      userApiSpy.getTokenRoles.and.returnValue(of(['role1', 'role2', 'role3']))

      component.onTabChange({ index: 2 }, userAssignments)

      component.idmRoles$.subscribe({
        next: (data) => {
          expect(data.length).toBe(3)
          expect(data[0]).toEqual({ label: 'role1', isUserAssignedRole: true } as ExtendedSelectItem)
          expect(data[1]).toEqual({ label: 'role2', isUserAssignedRole: true } as ExtendedSelectItem)
          expect(data[2]).toEqual({ label: 'role3', isUserAssignedRole: false } as ExtendedSelectItem)
          done()
        },
        error: done.fail
      })
      // do it again without extra data call
      component.onTabChange({ index: 2 }, userAssignments)
    })

    it('should getting my idm roles from token - failed', (done) => {
      initializeComponent()

      component.ngOnChanges()

      const errorResponse = { status: 403, statusText: 'No perissions to see roles from your token' }
      userApiSpy.getTokenRoles.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')

      component.onTabChange({ index: 2 }, userAssignments)

      component.idmRoles$.subscribe({
        next: (data) => {
          expect(data.length).toBe(0)
          expect(console.error).toHaveBeenCalledWith('getTokenRoles', errorResponse)
          expect(component.exceptionKeyIdmRoles).toEqual('EXCEPTIONS.HTTP_STATUS_' + errorResponse.status + '.ROLES')
          done()
        },
        error: done.fail
      })
    })

    it('should getting idm roles from idm - successful', (done) => {
      initializeComponent('userid', 'issuer')
      slotServiceSpy.isSomeComponentDefinedForSlot.and.returnValue(of(true))

      component.ngOnChanges()

      component.roleListEmitter.emit([{ name: 'role1' }, { name: 'role2' }])

      component.onTabChange({ index: 2 }, userAssignments)

      component.idmRoles$.subscribe({
        next: (data) => {
          expect(data.length).toBe(2)
          expect(data[0]).toEqual({ label: 'role1', isUserAssignedRole: true } as ExtendedSelectItem)
          expect(data[1]).toEqual({ label: 'role2', isUserAssignedRole: true } as ExtendedSelectItem)
          done()
        },
        error: done.fail
      })
    })

    it('should decline getting idm roles - missing issuer', () => {
      initializeComponent('userid')

      component.ngOnChanges()

      expect(component.exceptionKey).toBe('EXCEPTIONS.MISSING_ISSUER')
    })
  })
})
