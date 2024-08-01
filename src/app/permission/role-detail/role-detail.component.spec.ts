import { NO_ERRORS_SCHEMA } from '@angular/core'
import { HttpClientTestingModule } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { RouterTestingModule } from '@angular/router/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, throwError } from 'rxjs'

import { PortalMessageService, UserService } from '@onecx/portal-integration-angular'

import { Role, RoleAPIService } from 'src/app/shared/generated'
import { RoleDetailComponent } from './role-detail.component'

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

  const mockUserService = {
    lang$: {
      getValue: jasmine.createSpy('getValue').and.returnValue('en')
    },
    hasPermission: jasmine.createSpy('hasPermission').and.callFake((permissionName) => {
      if (permissionName === 'ROLE#EDIT' || permissionName === 'ROLE#DELETE') {
        return true
      } else {
        return false
      }
    })
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [RoleDetailComponent],
      imports: [
        RouterTestingModule,
        HttpClientTestingModule,
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
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
    roleApiSpy.searchAvailableRoles.calls.reset()
    roleApiSpy.createRole.calls.reset()
    roleApiSpy.updateRole.calls.reset()
    roleApiSpy.deleteRole.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should enable formGroup if user has permissions: edit mode', () => {
    component.changeMode = 'EDIT'
    component.formGroupRole = formGroup
    component.showIamRolesDialog = true
    spyOn(component, 'getIamRoles')

    component.ngOnChanges()

    expect(component.formGroupRole.enabled).toBeTrue()
    expect(component.formGroupRole.controls['name'].value).toEqual(role.name)
    expect(component.formGroupRole.controls['description'].value).toBeUndefined()
    expect(component.getIamRoles).toHaveBeenCalled()
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
      component.formGroupRole = formGroup

      component.onSaveRole()

      expect(msgServiceSpy.error).not.toHaveBeenCalledWith({
        summaryKey: 'ACTIONS.' + component.changeMode + '.ROLE',
        detailKey: 'VALIDATION.ERRORS.ROLE.' + component.changeMode + '_ALREADY_EXISTS'
      })
    })

    it('should check for duplicates in permissions - create', () => {
      component.roles = [role]
      component.changeMode = 'CREATE'
      component.formGroupRole = formGroup

      component.onSaveRole()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({
        summaryKey: 'ACTIONS.' + component.changeMode + '.ROLE',
        detailKey: 'VALIDATION.ERRORS.ROLE.' + component.changeMode + '_ALREADY_EXISTS'
      })
    })

    it('should create a permission', () => {
      component.changeMode = 'CREATE'
      component.formGroupRole = formGroup

      component.onSaveRole()

      expect(component.formGroupRole.valid).toBeTrue()
      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_OK' })
    })

    it('should display error when trying to create a permission failed', () => {
      roleApiSpy.createRole.and.returnValue(throwError(() => new Error()))
      component.changeMode = 'CREATE'
      component.formGroupRole = formGroup
      component.role!.id = undefined

      component.onSaveRole()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_NOK' })
    })

    it('should update a permission', () => {
      component.changeMode = 'EDIT'
      component.formGroupRole = formGroup

      component.onSaveRole()

      expect(component.formGroupRole.valid).toBeTrue()
      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_OK' })
    })

    it('should display error when trying to update a permission failed', () => {
      roleApiSpy.updateRole.and.returnValue(throwError(() => new Error()))
      component.changeMode = 'EDIT'
      component.formGroupRole = formGroup

      component.onSaveRole()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_NOK' })
    })
  })

  describe('oneDeleteConfirmation', () => {
    it('should delete a permission', () => {
      component.onDeleteConfirmation()

      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_OK' })
    })

    it('should display error when trying to delete a permission failed', () => {
      roleApiSpy.deleteRole.and.returnValue(throwError(() => new Error()))
      component.role!.id = undefined

      component.onDeleteConfirmation()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_NOK' })
    })
  })

  /**
   * Select IAM Roles to be added
   */
  describe('getIamRoles', () => {
    it('should populate iamRoles with unique roles', () => {
      const mockRoles = [{ name: 'Role1' }, { name: 'Role2' }]
      const mockData = { stream: mockRoles }
      roleApiSpy.searchAvailableRoles.and.returnValue(of(mockData))
      component.roles = [{ name: 'Role2' }]

      component.getIamRoles()

      expect(component.iamRoles.length).toBe(1)
      expect(component.iamRoles).toContain(mockRoles[0])
      expect(component.iamRoles).not.toContain(mockRoles[1])
    })

    it('should handle error response', () => {
      const errorResponse = { error: 'Error' }
      spyOn(console, 'error')
      roleApiSpy.searchAvailableRoles.and.returnValue(throwError(() => errorResponse))

      component.getIamRoles()

      expect(console.error).toHaveBeenCalledWith('Error')
    })
  })

  describe('onAddIamRoles', () => {
    it('should emit false if selectedIamRoles is empty', () => {
      spyOn(component.dataChanged, 'emit')
      component.selectedIamRoles = []

      component.onAddIamRoles()

      expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
    })

    it('should create a role and notify on success', () => {
      spyOn(component.dataChanged, 'emit')
      roleApiSpy.createRole.and.returnValue(of({}))

      component.selectedIamRoles = [{ name: 'role1' }]
      component.onAddIamRoles()

      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_OK' })
      expect(component.dataChanged.emit).toHaveBeenCalledWith(true)
    })

    it('should handle error if role could not be created', () => {
      spyOn(component.dataChanged, 'emit')
      const errorResponse = new Error('Test error')
      roleApiSpy.createRole.and.returnValue(throwError(() => errorResponse))

      component.selectedIamRoles = [{ name: 'role1' }]
      component.onAddIamRoles()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_NOK' })
      expect(component.dataChanged.emit).not.toHaveBeenCalled()
    })

    it('should emit false if selectedIamRoles is undefined', () => {
      spyOn(component.dataChanged, 'emit')

      component.selectedIamRoles = undefined
      component.onAddIamRoles()

      expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
    })
  })
})
