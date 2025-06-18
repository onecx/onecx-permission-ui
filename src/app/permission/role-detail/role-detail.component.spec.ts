import { NO_ERRORS_SCHEMA } from '@angular/core'
import { ComponentFixture, fakeAsync, TestBed, tick, waitForAsync } from '@angular/core/testing'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { provideHttpClient } from '@angular/common/http'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, throwError } from 'rxjs'

import { SlotService } from '@onecx/angular-remote-components'
import { PortalMessageService, UserService } from '@onecx/angular-integration-interface'

import { Role, RoleAPIService } from 'src/app/shared/generated'
import { IDMRole, RoleDetailComponent, slotInitializer } from './role-detail.component'

const role: Role = {
  id: 'roleId',
  name: 'roleName'
}

const formGroup = new FormGroup({
  id: new FormControl(null),
  name: new FormControl('name', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
  description: new FormControl(null)
})

describe('RoleDetailComponent', () => {
  let component: RoleDetailComponent
  let fixture: ComponentFixture<RoleDetailComponent>

  const msgServiceSpy = jasmine.createSpyObj<PortalMessageService>('PortalMessageService', ['success', 'error'])
  const roleApiSpy = {
    searchAvailableRoles: jasmine.createSpy('searchAvailableRoles').and.returnValue(of({})),
    createRole: jasmine.createSpy('createRole').and.returnValue(of({})),
    updateRole: jasmine.createSpy('updateRole').and.returnValue(of({})),
    deleteRole: jasmine.createSpy('deleteRole').and.returnValue(of({}))
  }
  const slotServiceSpy = {
    isSomeComponentDefinedForSlot: jasmine.createSpy('isSomeComponentDefinedForSlot').and.returnValue(of(true))
  }
  const mockUserService = {
    lang$: {
      getValue: jasmine.createSpy('getValue').and.returnValue('en')
    },
    hasPermission: jasmine.createSpy('hasPermission').and.callFake((permission) => {
      return permission === 'ROLE#EDIT' || permission === 'ROLE#DELETE'
    })
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [RoleDetailComponent],
      imports: [
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
    }).compileComponents()
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(RoleDetailComponent)
    component = fixture.componentInstance
    component.role = role
    fixture.detectChanges()
  })

  afterEach(() => {
    msgServiceSpy.success.calls.reset()
    msgServiceSpy.error.calls.reset()
    slotServiceSpy.isSomeComponentDefinedForSlot.calls.reset()
    roleApiSpy.searchAvailableRoles.calls.reset()
    roleApiSpy.createRole.calls.reset()
    roleApiSpy.updateRole.calls.reset()
    roleApiSpy.deleteRole.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  describe('form', () => {
    it('should enable formGroup if user has permissions: edit mode', () => {
      component.changeMode = 'EDIT'
      component.formGroup = formGroup
      component.showIamRolesDialog = false

      component.ngOnChanges()

      expect(component.formGroup.enabled).toBeTrue()
      expect(component.formGroup.controls['name'].value).toEqual(role.name)
      expect(component.formGroup.controls['description'].value).toBeUndefined()
    })
  })

  it('should notify parent that nothing has changed after closing the dialog', () => {
    spyOn(component.dataChanged, 'emit')

    component.onClose()

    expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
  })

  describe('onSaveRole', () => {
    it('should stop and notify that form is invalid onSave', () => {
      spyOn(console, 'info')

      component.onSaveRole()

      expect(console.info).toHaveBeenCalledWith('form not valid')
    })

    it('should check for duplicates in permissions - edit', () => {
      component.roles = [role]
      component.changeMode = 'EDIT'
      component.formGroup = formGroup

      component.onSaveRole()

      expect(msgServiceSpy.error).not.toHaveBeenCalledWith({
        summaryKey: 'ACTIONS.' + component.changeMode + '.ROLE',
        detailKey: 'VALIDATION.ERRORS.ROLE.' + component.changeMode + '_ALREADY_EXISTS'
      })
    })

    it('should check for duplicates in permissions - create', () => {
      component.roles = [role]
      component.changeMode = 'CREATE'
      component.formGroup = formGroup

      component.onSaveRole()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({
        summaryKey: 'ACTIONS.' + component.changeMode + '.ROLE',
        detailKey: 'VALIDATION.ERRORS.ROLE.' + component.changeMode + '_ALREADY_EXISTS'
      })
    })

    it('should create a role', () => {
      component.changeMode = 'CREATE'
      component.formGroup = formGroup

      component.onSaveRole()

      expect(component.formGroup.valid).toBeTrue()
      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_OK' })
    })

    it('should display error when trying to create a role failed', () => {
      const errorResponse = { status: 400, statusText: 'Error on creating a role' }
      roleApiSpy.createRole.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      component.changeMode = 'CREATE'
      component.formGroup = formGroup
      component.role!.id = undefined

      component.onSaveRole()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_NOK' })
    })

    it('should update a role', () => {
      component.changeMode = 'EDIT'
      component.formGroup = formGroup

      component.onSaveRole()

      expect(component.formGroup.valid).toBeTrue()
      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_OK' })
    })

    it('should display error when trying to update a role failed', () => {
      const errorResponse = { status: 400, statusText: 'Error on updating a role' }
      roleApiSpy.updateRole.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      component.changeMode = 'EDIT'
      component.formGroup = formGroup

      component.onSaveRole()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_NOK' })
      expect(console.error).toHaveBeenCalledWith('updateRole', errorResponse)
    })
  })

  describe('oneDeleteConfirmation', () => {
    it('should delete a role - ignoring because missing role id', () => {
      component.onDeleteConfirmation()
    })

    it('should delete a role', () => {
      component.role = { ...role, id: 'id' }
      component.onDeleteConfirmation()

      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_OK' })
    })

    it('should display error when trying to delete a role failed', () => {
      const errorResponse = { status: 400, statusText: 'Error on deleting a role' }
      roleApiSpy.deleteRole.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      component.role = { ...role, id: 'id' }

      component.onDeleteConfirmation()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_NOK' })
      expect(console.error).toHaveBeenCalledWith('deleteRole', errorResponse)
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

  /**
   * Get IAM Roles from Remote Component
   */
  describe('get IAM roles', () => {
    it('should get IAM roles - with getting data', fakeAsync(() => {
      component.showIamRolesDialog = true
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
      component.showIamRolesDialog = true
      component.isComponentDefined = true
      component.roles = [role]
      component.idmRolesOrg = [{ name: 'role1' }, { name: 'role2' }]

      component.ngOnChanges()

      component.roleListEmitter.emit([{ name: 'role1' }, { name: 'role2' }])

      expect(component.idmRoles.length).toBe(2)
      expect(component.idmRoles[0]).toEqual({ name: 'role1' } as IDMRole)
      expect(component.idmRoles[1]).toEqual({ name: 'role2' } as IDMRole)
    })
  })

  describe('onAddIamRoles', () => {
    it('should emit false if idmRolesSelected is empty', () => {
      spyOn(component.dataChanged, 'emit')
      component.idmRolesSelected = []

      component.onAddIamRoles()

      expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
    })
    it('should emit false if idmRolesSelected is undefined', () => {
      spyOn(component.dataChanged, 'emit')

      component.idmRolesSelected = []
      component.onAddIamRoles()

      expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
    })
  })

  describe('role creation', () => {
    it('should create a role and notify on success', () => {
      spyOn(component.dataChanged, 'emit')
      roleApiSpy.createRole.and.returnValue(of({}))

      component.idmRolesSelected = [{ name: 'role1' }]
      component.onAddIamRoles()

      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_OK' })
      expect(component.dataChanged.emit).toHaveBeenCalledWith(true)
    })

    it('should handle error if role could not be created', () => {
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
