import { NO_ERRORS_SCHEMA } from '@angular/core'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { provideHttpClient } from '@angular/common/http'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { BehaviorSubject, of, throwError } from 'rxjs'

import { PortalMessageService, UserService } from '@onecx/angular-integration-interface'

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
    createRole: jasmine.createSpy('createRole').and.returnValue(of({})),
    updateRole: jasmine.createSpy('updateRole').and.returnValue(of({}))
  }
  const langSubject = new BehaviorSubject('en')
  const mockUserService = {
    lang$: langSubject,
    hasPermission: jasmine.createSpy('hasPermission').and.callFake((permission) => {
      return permission === 'ROLE#EDIT' || permission === 'ROLE#DELETE'
    })
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        RoleDetailComponent,
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        provideHttpClientTesting(),
        provideHttpClient(),
        { provide: PortalMessageService, useValue: msgServiceSpy },
        { provide: RoleAPIService, useValue: roleApiSpy },
        { provide: UserService, useValue: mockUserService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .overrideComponent(RoleDetailComponent, {
        set: {
          template: '',
          imports: []
        }
      })
      .compileComponents()
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
    roleApiSpy.createRole.calls.reset()
    roleApiSpy.updateRole.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  describe('form', () => {
    it('should enable formGroup if user has permissions: edit mode', () => {
      component.changeMode = 'EDIT'
      component.formGroup = formGroup

      component.ngOnChanges()

      expect(component.formGroup.enabled).toBeTrue()
      expect(component.formGroup.controls['name'].value).toEqual(role.name)
      expect(component.formGroup.controls['description'].value).toBeUndefined()
    })
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
})
