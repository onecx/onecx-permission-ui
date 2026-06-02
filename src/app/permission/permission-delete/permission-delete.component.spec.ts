import { NO_ERRORS_SCHEMA } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { BehaviorSubject, of, throwError } from 'rxjs'

import { PortalMessageService, UserService } from '@onecx/angular-integration-interface'

import { Permission, PermissionAPIService } from 'src/app/shared/generated'
import { PermissionDeleteComponent } from './permission-delete.component'
import { PermissionViewRow } from '../app-detail/app-detail.component'

const perm1: Permission = {
  id: 'permId1',
  appId: 'appId',
  productName: 'prodName',
  resource: 'resource',
  action: 'action'
}
const permRow: PermissionViewRow = {
  ...perm1,
  key: 'key',
  roles: { undefined },
  appType: 'MFE',
  appDisplayName: 'appName',
  productDisplayName: 'prodName'
}

describe('PermissionDeleteComponent', () => {
  let component: PermissionDeleteComponent
  let fixture: ComponentFixture<PermissionDeleteComponent>

  const msgServiceSpy = jasmine.createSpyObj<PortalMessageService>('PortalMessageService', ['success', 'error'])
  const permApiSpy = jasmine.createSpyObj<PermissionAPIService>('PermissionAPIService', ['deletePermission'])
  const langSubject = new BehaviorSubject('en')

  const mockUserService = {
    lang$: langSubject,
    hasPermission: jasmine.createSpy('hasPermission').and.callFake((permissionName) => {
      return permissionName === 'PERMISSION#DELETE'
    })
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        PermissionDeleteComponent,
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PortalMessageService, useValue: msgServiceSpy },
        { provide: PermissionAPIService, useValue: permApiSpy },
        { provide: UserService, useValue: mockUserService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .overrideComponent(PermissionDeleteComponent, {
        set: {
          template: '',
          imports: []
        }
      })
      .compileComponents()
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(PermissionDeleteComponent)
    component = fixture.componentInstance
    component.permission = permRow
    permApiSpy.deletePermission.and.returnValue(of({}) as any)
    fixture.detectChanges()
  })

  afterEach(() => {
    msgServiceSpy.success.calls.reset()
    msgServiceSpy.error.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should notify parent that nothing has changed onClose', () => {
    spyOn(component.dataChanged, 'emit')

    component.onClose()

    expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
  })

  describe('Permission deletion', () => {
    it('should not delete if permission id is missing', () => {
      component.permission = { ...permRow, id: undefined }

      component.onDeleteConfirmation()

      expect(permApiSpy.deletePermission).not.toHaveBeenCalled()
    })

    it('should not delete if permission is undefined', () => {
      component.permission = undefined

      component.onDeleteConfirmation()

      expect(permApiSpy.deletePermission).not.toHaveBeenCalled()
    })

    it('should delete a permission successfully', () => {
      spyOn(component.dataChanged, 'emit')
      component.permission = { ...permRow, id: 'id' }

      component.onDeleteConfirmation()

      expect(permApiSpy.deletePermission).toHaveBeenCalledWith({ id: 'id' })
      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_OK' })
      expect(component.dataChanged.emit).toHaveBeenCalledWith(true)
    })

    it('should display error when trying to delete a permission failed', () => {
      const errorResponse = { error: 'Error on deleting a permission', status: 400 }
      permApiSpy.deletePermission.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      component.permission = { ...permRow, id: 'id' }

      component.onDeleteConfirmation()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_NOK' })
      expect(console.error).toHaveBeenCalledWith('deletePermission', errorResponse)
    })
  })
})
