import { NO_ERRORS_SCHEMA } from '@angular/core'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { provideHttpClient } from '@angular/common/http'
import { provideRouter } from '@angular/router'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, throwError } from 'rxjs'

import { PortalMessageService, UserService } from '@onecx/portal-integration-angular'

import { Role, IAMRole, RoleAPIService } from 'src/app/shared/generated'
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
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        provideHttpClientTesting(),
        provideHttpClient(),
        provideRouter([{ path: '', component: RoleDetailComponent }]),
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
    component.formGroup = formGroup
    component.showIamRolesDialog = true
    spyOn(component, 'searchIamRoles')

    component.ngOnChanges()

    expect(component.formGroup.enabled).toBeTrue()
    expect(component.formGroup.controls['name'].value).toEqual(role.name)
    expect(component.formGroup.controls['description'].value).toBeUndefined()
    expect(component.searchIamRoles).toHaveBeenCalled()
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
      const errorResponse = { error: 'Error on creating a role', status: 400 }
      roleApiSpy.createRole.and.returnValue(throwError(() => errorResponse))
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
      const errorResponse = { error: 'Error on updating a role', status: 400 }
      roleApiSpy.updateRole.and.returnValue(throwError(() => errorResponse))
      component.changeMode = 'EDIT'
      component.formGroup = formGroup

      component.onSaveRole()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_NOK' })
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
      const errorResponse = { error: 'Error on deleting a role', status: 400 }
      roleApiSpy.deleteRole.and.returnValue(throwError(() => errorResponse))
      component.role = { ...role, id: 'id' }

      component.onDeleteConfirmation()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_NOK' })
    })
  })

  /**
   * Select IAM Roles to be added
   */
  describe('searchIamRoles', () => {
    it('should clear selected IAM roles', () => {
      roleApiSpy.searchAvailableRoles.and.returnValue(of({ stream: [] }))
      component.selectedIamRoles = [{ name: 'role1' }, { name: 'role2' }] as IAMRole[]

      component.searchIamRoles()

      expect(component.selectedIamRoles).toEqual([])
    })

    it('should call searchAvailableRoles with correct parameters', () => {
      roleApiSpy.searchAvailableRoles.and.returnValue(of({ stream: [] }))
      component.searchIamRoles()
      expect(roleApiSpy.searchAvailableRoles).toHaveBeenCalledWith({ iAMRoleSearchCriteria: { pageSize: 1000 } })
    })

    it('should handle successful response', () => {
      const mockRoles = [
        { id: '1', name: 'Role 1' },
        { id: '2', name: 'Role 2' }
      ]
      roleApiSpy.searchAvailableRoles.and.returnValue(of({ stream: mockRoles }))

      component.searchIamRoles()

      component.iamRoles$.subscribe((roles) => {
        expect(roles).toEqual(mockRoles)
      })
    })

    it('should handle error response', () => {
      const errorResponse = { error: 'Error on retrieving IAM roles', status: 401 }
      roleApiSpy.searchAvailableRoles.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')

      component.searchIamRoles()

      component.iamRoles$.subscribe(() => {
        expect(component.exceptionKey).toEqual('EXCEPTIONS.HTTP_STATUS_' + errorResponse.status + '.ROLES')
        expect(console.error).toHaveBeenCalledWith('searchAvailableRoles():', errorResponse)
      })
    })

    it('should handle empty stream in response', () => {
      roleApiSpy.searchAvailableRoles.and.returnValue(of({}))

      component.searchIamRoles()

      component.iamRoles$.subscribe((roles) => {
        expect(roles).toEqual([])
      })
    })
  })

  describe('sortRoleByName', () => {
    it('should return negative value when first role name comes before second alphabetically', () => {
      const roleA = { name: 'Admin' }
      const roleB = { name: 'User' }
      expect(component.sortRoleByName(roleA, roleB)).toBeLessThan(0)
    })

    it('should return positive value when first role name comes after second alphabetically', () => {
      const roleA = { name: 'User' }
      const roleB = { name: 'Admin' }
      expect(component.sortRoleByName(roleA, roleB)).toBeGreaterThan(0)
    })

    it('should return zero when role names are the same', () => {
      const roleA = { name: 'Admin' }
      const roleB = { name: 'Admin' }
      expect(component.sortRoleByName(roleA, roleB)).toBe(0)
    })

    it('should be case-insensitive', () => {
      const roleA = { name: 'admin' }
      const roleB = { name: 'Admin' }
      expect(component.sortRoleByName(roleA, roleB)).toBe(0)
    })

    it('should handle undefined names', () => {
      const roleA = { name: undefined }
      const roleB = { name: 'Admin' }
      expect(component.sortRoleByName(roleA, roleB)).toBeLessThan(0)
    })

    it('should handle empty string names', () => {
      const roleA = { name: '' }
      const roleB = { name: 'Admin' }
      expect(component.sortRoleByName(roleA, roleB)).toBeLessThan(0)
    })

    it('should handle both names being undefined', () => {
      const roleA = { name: undefined }
      const roleB = { name: undefined }
      expect(component.sortRoleByName(roleA, roleB)).toBe(0)
    })
  })

  describe('onAddIamRoles', () => {
    it('should emit false if selectedIamRoles is empty', () => {
      spyOn(component.dataChanged, 'emit')
      component.selectedIamRoles = []

      component.onAddIamRoles()

      expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
    })
    it('should emit false if selectedIamRoles is undefined', () => {
      spyOn(component.dataChanged, 'emit')

      component.selectedIamRoles = []
      component.onAddIamRoles()

      expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
    })
  })

  describe('role creation', () => {
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
      const errorResponse = { error: 'Role could not be created', status: 400 }
      roleApiSpy.createRole.and.returnValue(throwError(() => errorResponse))

      component.selectedIamRoles = [{ name: 'role1' }]
      component.onAddIamRoles()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_NOK' })
      expect(component.dataChanged.emit).not.toHaveBeenCalled()
    })
  })
})
