import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { NO_ERRORS_SCHEMA } from '@angular/core'
import { TableModule } from 'primeng/table'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { Router } from '@angular/router'
import { of, ReplaySubject } from 'rxjs'

import { AppConfigService } from '@onecx/portal-integration-angular'
import { BASE_URL, RemoteComponentConfig } from '@onecx/angular-remote-components'

import { OneCXUserRolesPermissionsComponent } from './user-roles-permissions.component'
// import { environment } from 'src/environments/environment'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { RoleAPIService, UserAPIService, UserAssignment } from 'src/app/shared/generated'
import { provideHttpClient } from '@angular/common/http'

const userAssgnmnts: UserAssignment[] = [
  {
    roleName: 'role1',
    productName: 'prod1',
    applicationId: 'ocx-app1'
  },
  {
    roleName: 'role2',
    productName: 'prod2',
    applicationId: 'ocx-app2'
  }
]

const roles = ['role1', 'role2']

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

  beforeEach(() => {
    // component.environment = environment
  })

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
})
