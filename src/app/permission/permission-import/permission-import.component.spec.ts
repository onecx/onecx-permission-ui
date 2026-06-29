import { NO_ERRORS_SCHEMA } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, throwError } from 'rxjs'
import { FileSelectEvent } from 'primeng/fileupload'

import { PortalMessageService } from '@onecx/angular-integration-interface'

import { AssignmentAPIService, Permission } from 'src/app/shared/generated'
import { ImportError, PermissionImportComponent } from './permission-import.component'

const permission: Permission = {
  appId: 'onecx-app',
  productName: 'onecx-product'
}

describe('PermissionImportComponent', () => {
  let component: PermissionImportComponent
  let fixture: ComponentFixture<PermissionImportComponent>

  const assgnmtApiSpy = {
    importAssignments: jasmine.createSpy('importAssignments').and.returnValue(of({}))
  }
  const msgServiceSpy = jasmine.createSpyObj<PortalMessageService>('PortalMessageService', ['success', 'error'])

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        PermissionImportComponent,
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        provideHttpClientTesting(),
        provideHttpClient(),
        { provide: AssignmentAPIService, useValue: assgnmtApiSpy },
        { provide: PortalMessageService, useValue: msgServiceSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .overrideComponent(PermissionImportComponent, {
        set: {
          template: '',
          imports: []
        }
      })
      .compileComponents()
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(PermissionImportComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  afterEach(() => {
    assgnmtApiSpy.importAssignments.calls.reset()
    msgServiceSpy.success.calls.reset()
    msgServiceSpy.error.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should close dialog and emit false', () => {
    spyOn(component.displayImportDialogChange, 'emit')

    component.onCloseImportDialog()

    expect(component.displayImportDialogChange.emit).toHaveBeenCalledWith(false)
  })

  it('should reset importError when onImportClear is called', () => {
    component.importError = {
      name: 'Parse error',
      ok: false,
      status: 400,
      statusText: 'Parser error',
      message: '',
      error: { errorCode: 'PARSER', detail: 'parse error' },
      exceptionKey: 'ACTIONS.IMPORT.ERROR.PARSER'
    }

    component.onImportClear()

    expect(component.importError).toBeUndefined()
  })

  describe('on import file select', () => {
    let file: File
    let event: FileSelectEvent

    beforeEach(() => {
      file = new File(['file content'], 'test.txt', { type: 'text/plain' })
      event = { originalEvent: new Event('change'), files: [file], currentFiles: [file] }
    })

    it('should select a file and parse', async () => {
      const mockContent = '{ "appId": "id", "name": "onecx-permission-ui", "productName": "onecx-permission" }'
      spyOn(file, 'text').and.returnValue(Promise.resolve(mockContent))

      await component.onImportFileSelect(event)

      expect(file.text).toHaveBeenCalled()
      expect(component.importAssignmentItem).toEqual(JSON.parse(mockContent))
    })

    it('should handle JSON parse error on invalid file content', async () => {
      const mockContent = 'content'
      const errorResponse: ImportError = {
        name: 'Parse error',
        ok: false,
        status: 400,
        statusText: 'Parser error',
        message: '',
        error: { errorCode: 'PARSER', detail: 'SyntaxError: Unexpected token \'c\', "content"' },
        exceptionKey: 'ACTIONS.IMPORT.ERROR.PARSER'
      }
      spyOn(file, 'text').and.returnValue(Promise.resolve(mockContent))
      spyOn(console, 'error')

      await component.onImportFileSelect(event)

      expect(console.error).toHaveBeenCalled()
      expect(component.importError?.name).toEqual(errorResponse.name)
      expect(component.importError?.statusText).toEqual(errorResponse.statusText)
    })
  })

  describe('on import confirmation => uploading', () => {
    it('should successfully import assignments', (done) => {
      assgnmtApiSpy.importAssignments.and.returnValue(of(permission))
      spyOn(component.displayImportDialogChange, 'emit')
      spyOn(component.importDone, 'emit')
      component.importAssignmentItem = permission

      component.onImportConfirmation()

      setTimeout(() => {
        expect(component.displayImportDialogChange.emit).toHaveBeenCalledWith(false)
        expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.OK' })
        expect(component.importDone.emit).toHaveBeenCalled()
        done()
      })
    })

    it('should handle error on import failure', (done) => {
      const errorResponse = {
        name: 'Upload error',
        ok: false,
        status: 409,
        statusText: 'Upload error',
        message: '',
        error: { errorCode: 'UPLOAD', detail: {} },
        exceptionKey: 'EXCEPTIONS.HTTP_STATUS_409.PERMISSIONS'
      }
      assgnmtApiSpy.importAssignments.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      component.importAssignmentItem = permission

      component.onImportConfirmation()

      setTimeout(() => {
        expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.NOK' })
        expect(component.importError).toEqual(errorResponse)
        expect(console.error).toHaveBeenCalledWith('importAssignments', errorResponse)
        done()
      }, 0)
    })

    it('should not call importAssignments if importAssignmentItem is not defined', () => {
      component.importAssignmentItem = null

      component.onImportConfirmation()

      expect(assgnmtApiSpy.importAssignments).not.toHaveBeenCalled()
    })
  })
})
