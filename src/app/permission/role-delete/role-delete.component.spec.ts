import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { BehaviorSubject, of, throwError } from 'rxjs'

import { PortalMessageService, UserService } from '@onecx/angular-integration-interface'

import { Role, RoleAPIService } from 'src/app/shared/generated'
import { RoleDeleteComponent } from './role-delete.component'

const role: Role = {
  id: 'roleId',
  name: 'roleName'
}

describe('RoleDeleteComponent', () => {
  let component: RoleDeleteComponent
  let fixture: ComponentFixture<RoleDeleteComponent>

  const msgServiceSpy = jasmine.createSpyObj<PortalMessageService>('PortalMessageService', ['success', 'error'])
  const roleApiSpy = jasmine.createSpyObj<RoleAPIService>('RoleAPIService', ['deleteRole'])
  const langSubject = new BehaviorSubject('en')

  const mockUserService = {
    lang$: langSubject,
    hasPermission: jasmine.createSpy('hasPermission').and.callFake((permissionName) => {
      return permissionName === 'ROLE#DELETE'
    })
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        RoleDeleteComponent,
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PortalMessageService, useValue: msgServiceSpy },
        { provide: RoleAPIService, useValue: roleApiSpy },
        { provide: UserService, useValue: mockUserService }
      ]
    })
      .overrideComponent(RoleDeleteComponent, {
        set: {
          template: '',
          imports: []
        }
      })
      .compileComponents()
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(RoleDeleteComponent)
    component = fixture.componentInstance
    component.role = role
    roleApiSpy.deleteRole.and.returnValue(of({}) as any)
    fixture.detectChanges()
  })

  afterEach(() => {
    msgServiceSpy.success.calls.reset()
    msgServiceSpy.error.calls.reset()
    roleApiSpy.deleteRole.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  describe('Role deletion', () => {
    it('should not delete if role id is missing', () => {
      component.role = { ...role, id: undefined }

      component.onDeleteConfirmation()

      expect(roleApiSpy.deleteRole).not.toHaveBeenCalled()
    })

    it('should not delete if role is undefined', () => {
      component.role = undefined

      component.onDeleteConfirmation()

      expect(roleApiSpy.deleteRole).not.toHaveBeenCalled()
    })

    it('should delete a role successfully', () => {
      spyOn(component.dataChanged, 'emit')
      component.role = { ...role, id: 'id' }

      component.onDeleteConfirmation()

      expect(roleApiSpy.deleteRole).toHaveBeenCalledWith({ id: 'id' })
      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_OK' })
      expect(component.dataChanged.emit).toHaveBeenCalledWith(true)
    })

    it('should display error when trying to delete a role failed', () => {
      const errorResponse = { error: 'Error on deleting a role', status: 400 }
      roleApiSpy.deleteRole.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      component.role = { ...role, id: 'id' }

      component.onDeleteConfirmation()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_NOK' })
      expect(console.error).toHaveBeenCalledWith('deleteRole', errorResponse)
    })
  })
})
