import { NO_ERRORS_SCHEMA } from '@angular/core'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, throwError } from 'rxjs'

import { PortalMessageService, UserService } from '@onecx/angular-integration-interface'

import { Permission, PermissionAPIService } from 'src/app/shared/generated'
import { PermissionDetailComponent } from './permission-detail.component'
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

const formGroup = new FormGroup({
  appId: new FormControl('appId', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
  productName: new FormControl('prodName', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
  resource: new FormControl('resource', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
  action: new FormControl('action', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
  description: new FormControl(''),
  mandatory: new FormControl(false),
  operator: new FormControl(false)
})

describe('PermissionDetailComponent', () => {
  let component: PermissionDetailComponent
  let fixture: ComponentFixture<PermissionDetailComponent>

  const msgServiceSpy = jasmine.createSpyObj<PortalMessageService>('PortalMessageService', ['success', 'error'])
  const permApiSpy = jasmine.createSpyObj<PermissionAPIService>('PermissionAPIService', [
    'createPermission',
    'updatePermission',
    'deletePermission'
  ])

  const mockUserService = {
    lang$: {
      getValue: jasmine.createSpy('getValue').and.returnValue('en')
    },
    hasPermission: jasmine.createSpy('hasPermission').and.callFake((permissionName) => {
      return (
        permissionName === 'PERMISSION#CREATE' ||
        permissionName === 'PERMISSION#EDIT' ||
        permissionName === 'PERMISSION#DELETE'
      )
    })
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [PermissionDetailComponent],
      imports: [
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        provideHttpClientTesting(),
        { provide: PortalMessageService, useValue: msgServiceSpy },
        { provide: PermissionAPIService, useValue: permApiSpy },
        { provide: UserService, useValue: mockUserService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents()
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(PermissionDetailComponent)
    component = fixture.componentInstance
    component.permission = permRow
    permApiSpy.createPermission.and.returnValue(of({}) as any)
    permApiSpy.updatePermission.and.returnValue(of({}) as any)
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

  it('should enable formGroup if user has permissions: edit mode', () => {
    component.changeMode = 'EDIT'

    component.ngOnChanges()

    expect(component.formGroup.enabled).toBeTrue()
    expect(component.formGroup.controls['appId'].disabled).toBeTrue()
    expect(component.formGroup.controls['productName'].disabled).toBeTrue()
    expect(component.formGroup.controls['mandatory'].disabled).toBeTrue()
    expect(component.formGroup.controls['operator'].disabled).toBeTrue()
  })

  it('should enable formGroup if user has permissions: create mode', () => {
    component.changeMode = 'CREATE'
    component.permission = undefined

    component.ngOnChanges()

    expect(component.formGroup.enabled).toBeTrue()
  })

  it('should enable formGroup if user has permissions: copy mode', () => {
    component.changeMode = 'CREATE'
    component.permission = permRow

    component.ngOnChanges()

    expect(component.formGroup.enabled).toBeTrue()
    expect(component.formGroup.controls['mandatory'].disabled).toBeTrue()
    expect(component.formGroup.controls['operator'].disabled).toBeTrue()
  })

  it('should notify parent that nothing has changed onClose', () => {
    spyOn(component.dataChanged, 'emit')

    component.onClose()

    expect(component.dataChanged.emit).toHaveBeenCalledWith(false)
  })

  it('should stop and notify that form is invalid onSave', () => {
    spyOn(console, 'info')

    component.onSave()

    expect(console.info).toHaveBeenCalledWith('form not valid')
  })

  it('should check for duplicates in permissions - edit', () => {
    component.permissions = [perm1]
    component.changeMode = 'EDIT'
    component.formGroup = formGroup

    component.onSave()

    expect(msgServiceSpy.error).not.toHaveBeenCalledWith({
      summaryKey: 'ACTIONS.' + component.changeMode + '.PERMISSION',
      detailKey: 'VALIDATION.ERRORS.PERMISSION.' + component.changeMode + '_ALREADY_EXISTS'
    })
  })

  it('should check for duplicates in permissions - create', () => {
    component.permissions = [perm1]
    component.changeMode = 'CREATE'
    component.formGroup = formGroup

    component.onSave()

    expect(msgServiceSpy.error).toHaveBeenCalledWith({
      summaryKey: 'ACTIONS.' + component.changeMode + '.PERMISSION',
      detailKey: 'VALIDATION.ERRORS.PERMISSION.' + component.changeMode + '_ALREADY_EXISTS'
    })
  })

  describe('Permission creation', () => {
    it('should create a permission', () => {
      component.changeMode = 'CREATE'
      component.formGroup = formGroup

      component.onSave()

      expect(component.formGroup.valid).toBeTrue()
      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.PERMISSION_OK' })
    })

    it('should display error when trying to create a permission failed', () => {
      const errorResponse = { error: 'Error on creating a permission', status: 400 }
      permApiSpy.createPermission.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      component.changeMode = 'CREATE'
      component.formGroup = formGroup
      component.permission!.id = undefined

      component.onSave()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.PERMISSION_NOK' })
      expect(console.error).toHaveBeenCalledWith('createPermission', errorResponse)
    })
  })

  describe('Permission update', () => {
    it('should update a permission', () => {
      component.changeMode = 'EDIT'
      component.formGroup = formGroup

      component.onSave()

      expect(component.formGroup.valid).toBeTrue()
      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.EDIT.MESSAGE.PERMISSION_OK' })
    })

    it('should display error when trying to update a permission failed', () => {
      const errorResponse = { error: 'Error on updating a permission', status: 400 }
      permApiSpy.updatePermission.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      component.changeMode = 'EDIT'
      component.formGroup = formGroup

      component.onSave()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.EDIT.MESSAGE.PERMISSION_NOK' })
      expect(console.error).toHaveBeenCalledWith('updatePermission', errorResponse)
    })
  })

  describe('Permission deletion', () => {
    it('should delete a permission - ignoring because missing permission id', () => {
      component.onDeleteConfirmation()
    })

    it('should delete a permission', () => {
      component.permission = { ...permRow, id: 'id' }

      component.onDeleteConfirmation()

      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_OK' })
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
