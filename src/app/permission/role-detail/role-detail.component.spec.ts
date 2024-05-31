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
  const roleApiSpy = jasmine.createSpyObj<RoleAPIService>('RoleAPIService', ['createRole', 'updateRole', 'deleteRole'])

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
    roleApiSpy.createRole.and.returnValue(of({}) as any)
    roleApiSpy.updateRole.and.returnValue(of({}) as any)
    roleApiSpy.deleteRole.and.returnValue(of({}) as any)
    fixture.detectChanges()
  })

  afterEach(() => {
    msgServiceSpy.success.calls.reset()
    msgServiceSpy.error.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should enable formGroup if user has permissions: edit mode', () => {
    component.changeMode = 'EDIT'
    component.formGroupRole = formGroup

    component.ngOnChanges()

    expect(component.formGroupRole.enabled).toBeTrue()
    expect(component.formGroupRole.controls['name'].value).toEqual(role.name)
    expect(component.formGroupRole.controls['description'].value).toBeUndefined()
  })

  it('should notify parent that nothing has changed onClose', () => {
    spyOn(component.dataChanged, 'emit')

    component.onClose()

    expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
  })

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
