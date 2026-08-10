import { provideHttpClient } from '@angular/common/http'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { provideNoopAnimations } from '@angular/platform-browser/animations'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { of, throwError } from 'rxjs'

import { FileSelectEvent } from 'primeng/fileupload'

import { PortalMessageService } from '@onecx/angular-integration-interface'

import { AssignmentAPIService } from 'src/app/shared/generated'
import { ImportError, PermissionImportComponent, AssignmentSnapshot } from './permission-import.component'

const assignmentSnapshot: AssignmentSnapshot = {
  id: '123',
  created: '2024-06-01T12:00:00Z',
  assignments: {
    'onecx-app': {
      'onecx-product': {
        'onecx-microservice': {
          'onecx-role': {
            resource1: ['read', 'write'],
            resource2: ['read', 'write', 'delete']
          }
        }
      }
    }
  }
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
      providers: [provideHttpClientTesting(), provideHttpClient(), provideNoopAnimations()]
    })
      .overrideComponent(PermissionImportComponent, {
        add: {
          providers: [
            { provide: PortalMessageService, useValue: msgServiceSpy },
            { provide: AssignmentAPIService, useValue: assgnmtApiSpy }
          ]
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
      exceptionKey: 'VALIDATION.ERRORS.IMPORT_GENERAL_ERROR'
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

    it('should select a file and parse - content structure ok', async () => {
      const mockContent =
        '{ "id": "123", "assignments": {"onecx-permission-ui": {"onecx-admin": {"password": "write"} } } }'
      spyOn(file, 'text').and.returnValue(Promise.resolve(mockContent))

      await component.onImportFileSelect(event)

      expect(file.text).toHaveBeenCalled()
      expect(component.importSnapshot).toEqual(JSON.parse(mockContent))
    })

    it('should select a file and parse - content structure not ok', async () => {
      const mockContent = '{ "id": "123", "unknown": {"blabla": "blub"} }'
      const errorResponse: ImportError = {
        name: 'Invalid data',
        ok: false,
        status: 400,
        statusText: 'Invalid data',
        message: '',
        error: { errorCode: 'CONTENT' },
        exceptionKey: 'VALIDATION.ERRORS.IMPORT_CONTENT_ERROR'
      }
      spyOn(file, 'text').and.returnValue(Promise.resolve(mockContent))
      spyOn(console, 'error')

      await component.onImportFileSelect(event)

      expect(file.text).toHaveBeenCalled()
      expect(component.importSnapshot).toEqual(JSON.parse(mockContent))
      expect(component.importError?.name).toEqual(errorResponse.name)
      expect(component.importError?.statusText).toEqual(errorResponse.statusText)
      expect(component.importError?.exceptionKey).toEqual(errorResponse.exceptionKey)
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
        exceptionKey: 'VALIDATION.ERRORS.IMPORT_GENERAL_ERROR'
      }
      spyOn(file, 'text').and.returnValue(Promise.resolve(mockContent))
      spyOn(console, 'error')

      await component.onImportFileSelect(event)

      expect(console.error).toHaveBeenCalled()
      expect(component.importError?.name).toEqual(errorResponse.name)
      expect(component.importError?.statusText).toEqual(errorResponse.statusText)
      expect(component.importError?.exceptionKey).toEqual(errorResponse.exceptionKey)
    })

    it('should use String(err) for error detail when thrown exception is not an Error instance', async () => {
      spyOn(file, 'text').and.returnValue(Promise.resolve('{}'))
      spyOn(JSON, 'parse').and.callFake(() => {
        throw 'non-error string'
      })
      spyOn(console, 'error')

      await component.onImportFileSelect(event)

      expect(component.importError?.error?.detail).toEqual('non-error string')
      expect(component.importError?.error?.errorCode).toEqual('PARSER')
      expect(component.importError?.exceptionKey).toEqual('VALIDATION.ERRORS.IMPORT_GENERAL_ERROR')
    })
  })

  describe('on import confirmation => uploading', () => {
    it('should successfully import assignments', (done) => {
      assgnmtApiSpy.importAssignments.and.returnValue(of(assignmentSnapshot))
      spyOn(component.displayImportDialogChange, 'emit')
      spyOn(component.importDone, 'emit')
      component.importSnapshot = assignmentSnapshot

      component.onImportConfirmation()

      setTimeout(() => {
        expect(component.displayImportDialogChange.emit).toHaveBeenCalledWith(false)
        expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.OK' })
        expect(component.importDone.emit).toHaveBeenCalled()
        done()
      })
    })

    it('should handle error on import failure', (done) => {
      const errorResponse: ImportError = {
        name: 'Upload error',
        ok: false,
        status: 409,
        statusText: 'Upload error',
        message: '',
        error: { errorCode: 'UPLOAD', detail: '' },
        exceptionKey: 'EXCEPTIONS.HTTP_STATUS_409.PERMISSIONS'
      }
      assgnmtApiSpy.importAssignments.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      component.importSnapshot = assignmentSnapshot

      component.onImportConfirmation()

      setTimeout(() => {
        expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.NOK' })
        expect(component.importError).toEqual(errorResponse)
        expect(console.error).toHaveBeenCalledWith('importSnapshot', errorResponse)
        done()
      }, 0)
    })

    it('should not call importAssignments if importAssignments is not defined', () => {
      component.importSnapshot = undefined

      component.onImportConfirmation()

      expect(assgnmtApiSpy.importAssignments).not.toHaveBeenCalled()
    })
  })
})
