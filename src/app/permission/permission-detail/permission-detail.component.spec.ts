import { NO_ERRORS_SCHEMA } from '@angular/core'
import { HttpClientTestingModule } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { RouterTestingModule } from '@angular/router/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, throwError } from 'rxjs'

import { PortalMessageService, UserService } from '@onecx/portal-integration-angular'
import { Permission, PermissionAPIService } from 'src/app/shared/generated'
import { PermissionDetailComponent } from './permission-detail.component'
import { PermissionViewRow } from '../app-detail/app-detail.component'
import { FormGroup, FormControl } from '@angular/forms'

const perm1: Permission = {
  id: 'permId1',
  appId: 'appId1',
  productName: 'prodName1'
}
const permRow: PermissionViewRow = {
  ...perm1,
  key: 'key',
  roles: { undefined },
  appType: 'MFE',
  appDisplayName: 'appName',
  productDisplayName: 'prodName'
}

fdescribe('PermissionDetailComponent', () => {
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
      if (
        permissionName === 'PERMISSION#CREATE' ||
        permissionName === 'PERMISSION#EDIT' ||
        permissionName === 'PERMISSION#DELETE'
      ) {
        return true
      } else {
        return false
      }
    })
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [PermissionDetailComponent],
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

  it('should create a permission', () => {
    component.changeMode = 'CREATE'
    component.formGroup = new FormGroup({
      appId: new FormControl({ value: '', disabled: true }),
      productName: new FormControl({ value: '', disabled: true }),
      resource: new FormControl({ value: '', disabled: true }),
      action: new FormControl({ value: '', disabled: true }),
      description: new FormControl({ value: '', disabled: true }),
      mandatory: new FormControl({ value: false, disabled: true }),
      operator: new FormControl({ value: false, disabled: true })
    })

    component.onSave()

    expect(component.formGroup.valid).toBeTrue()
    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.CREATE.MESSAGE.PERMISSION_OK' })
  })

  it('should delete a permission', () => {
    component.onDeleteConfirmation()

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_OK' })
  })

  it('should delete a permission', () => {
    component.onDeleteConfirmation()

    expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_OK' })
  })

  it('should display error when trying to delete a permission failed', () => {
    permApiSpy.deletePermission.and.returnValue(throwError(() => new Error()))
    component.permission!.id = undefined

    component.onDeleteConfirmation()

    expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_NOK' })
  })
})
