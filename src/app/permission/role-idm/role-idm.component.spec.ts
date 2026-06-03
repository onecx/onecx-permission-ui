import { NO_ERRORS_SCHEMA } from '@angular/core'
import { ComponentFixture, fakeAsync, TestBed, tick, waitForAsync } from '@angular/core/testing'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { provideHttpClient } from '@angular/common/http'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { BehaviorSubject, of, throwError } from 'rxjs'

import { SlotService } from '@onecx/angular-remote-components'
import { PortalMessageService, UserService } from '@onecx/angular-integration-interface'

import { Role, RoleAPIService } from 'src/app/shared/generated'
import { IDMRole, RoleIdmComponent, slotInitializer } from './role-idm.component'

const role: Role = {
  id: 'roleId',
  name: 'roleName'
}

describe('RoleIdmComponent', () => {
  let component: RoleIdmComponent
  let fixture: ComponentFixture<RoleIdmComponent>

  const msgServiceSpy = jasmine.createSpyObj<PortalMessageService>('PortalMessageService', ['success', 'error'])
  const roleApiSpy = {
    createRole: jasmine.createSpy('createRole').and.returnValue(of({}))
  }
  const slotServiceSpy = {
    init: jasmine.createSpy('init'),
    isSomeComponentDefinedForSlot: jasmine.createSpy('isSomeComponentDefinedForSlot').and.returnValue(of(true))
  }
  const langSubject = new BehaviorSubject('en')
  const mockUserService = {
    lang$: langSubject,
    hasPermission: jasmine.createSpy('hasPermission').and.callFake((permission) => {
      return permission === 'ROLE#CREATE'
    })
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        RoleIdmComponent,
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        provideHttpClientTesting(),
        provideHttpClient(),
        { provide: SlotService, useValue: slotServiceSpy },
        { provide: PortalMessageService, useValue: msgServiceSpy },
        { provide: RoleAPIService, useValue: roleApiSpy },
        { provide: UserService, useValue: mockUserService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .overrideComponent(RoleIdmComponent, {
        set: {
          template: '',
          imports: []
        }
      })
      .compileComponents()
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(RoleIdmComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  afterEach(() => {
    msgServiceSpy.success.calls.reset()
    msgServiceSpy.error.calls.reset()
    slotServiceSpy.isSomeComponentDefinedForSlot.calls.reset()
    roleApiSpy.createRole.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
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

  describe('get IAM roles', () => {
    it('should get IAM roles - with getting data', fakeAsync(() => {
      component.visible = true
      component.isComponentDefined = false
      component.roles = [role]
      slotServiceSpy.isSomeComponentDefinedForSlot.and.returnValue(of(true))

      component.ngOnChanges()
      tick(5000)

      component.roleListEmitter.emit([{ name: 'role1' }, { name: 'role2' }])

      expect(component.idmRoles.length).toBe(2)
      expect(component.idmRoles[0]).toEqual({ name: 'role1' } as IDMRole)
      expect(component.idmRoles[1]).toEqual({ name: 'role2' } as IDMRole)
    }))

    it('should get IAM roles - reuse existing data', () => {
      component.visible = true
      component.isComponentDefined = true
      component.roles = [role]
      component.idmRolesOrg = [{ name: 'role1' }, { name: 'role2' }]

      component.ngOnChanges()

      expect(component.idmRoles.length).toBe(2)
      expect(component.idmRoles[0]).toEqual({ name: 'role1' } as IDMRole)
      expect(component.idmRoles[1]).toEqual({ name: 'role2' } as IDMRole)
    })

    it('should not initialize when dialog is not visible', () => {
      component.visible = false

      component.ngOnChanges()

      expect(slotServiceSpy.isSomeComponentDefinedForSlot).not.toHaveBeenCalled()
    })

    it('should handle slot component not defined', fakeAsync(() => {
      component.visible = true
      component.isComponentDefined = false
      slotServiceSpy.isSomeComponentDefinedForSlot.and.returnValue(of(false))

      component.ngOnChanges()
      tick(5000)

      expect(component.isComponentDefined).toBeFalse()
    }))
  })

  describe('onAddIamRoles', () => {
    it('should emit false if idmRolesSelected is empty', () => {
      spyOn(component.dataChanged, 'emit')
      component.idmRolesSelected = []

      component.onAddIamRoles()

      expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
    })

    it('should create roles and notify on success', () => {
      spyOn(component.dataChanged, 'emit')
      roleApiSpy.createRole.and.returnValue(of({}))

      component.idmRolesSelected = [{ name: 'role1' }]
      component.onAddIamRoles()

      expect(roleApiSpy.createRole).toHaveBeenCalledWith({ createRolesRequest: { roles: [{ name: 'role1' }] } })
      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_OK' })
      expect(component.dataChanged.emit).toHaveBeenCalledWith(true)
      expect(component.idmRolesSelected).toEqual([])
    })

    it('should handle error if roles could not be created', () => {
      spyOn(component.dataChanged, 'emit')
      const errorResponse = { status: 400, statusText: 'Role could not be created' }
      roleApiSpy.createRole.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')

      component.idmRolesSelected = [{ name: 'role1' }]
      component.onAddIamRoles()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_NOK' })
      expect(component.dataChanged.emit).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledWith('createRole', errorResponse)
    })
  })
})
