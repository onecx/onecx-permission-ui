import { NO_ERRORS_SCHEMA } from '@angular/core'
import { provideHttpClientTesting } from '@angular/common/http/testing'
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { TranslateTestingModule } from 'ngx-translate-testing'
import { DataViewModule } from 'primeng/dataview'
import { of, throwError } from 'rxjs'

import { ApplicationAPIService, WorkspaceAPIService, AssignmentAPIService } from 'src/app/shared/generated'
import { PermissionExportComponent } from './permission-export.component'
import { PortalMessageService } from '@onecx/angular-integration-interface'
import { provideHttpClient } from '@angular/common/http'

describe('PermissionExportComponent', () => {
  let component: PermissionExportComponent
  let fixture: ComponentFixture<PermissionExportComponent>

  const appApiSpy = jasmine.createSpyObj<ApplicationAPIService>('ApplicationAPIService', ['searchApplications'])
  const assgnmtApiSpy = {
    searchAssignments: jasmine.createSpy('searchAssignments').and.returnValue(of({})),
    importAssignments: jasmine.createSpy('importAssignments').and.returnValue(of({})),
    exportAssignments: jasmine.createSpy('exportAssignments').and.returnValue(of({}))
  }

  const wsApiSpy = jasmine.createSpyObj<WorkspaceAPIService>('WorkspaceAPIService', ['searchWorkspaces'])
  const msgServiceSpy = jasmine.createSpyObj<PortalMessageService>('PortalMessageService', ['success', 'error', 'info'])

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [PermissionExportComponent],
      imports: [
        DataViewModule,
        TranslateTestingModule.withTranslations({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        }).withDefaultLanguage('en')
      ],
      providers: [
        provideHttpClientTesting(),
        provideHttpClient(),
        { provide: ApplicationAPIService, useValue: appApiSpy },
        { provide: AssignmentAPIService, useValue: assgnmtApiSpy },
        { provide: WorkspaceAPIService, useValue: wsApiSpy },
        { provide: PortalMessageService, useValue: msgServiceSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents()
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(PermissionExportComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  afterEach(() => {
    assgnmtApiSpy.exportAssignments.calls.reset()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  describe('onExportConfirmation', () => {
    it('should export assignment items', () => {
      assgnmtApiSpy.exportAssignments.and.returnValue(of({} as any))
      const selectedNames = ['Product1', 'Product2']
      component.selectedProductNames = selectedNames

      component.onExportConfirmation()

      expect(msgServiceSpy.success).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.EXPORT.MESSAGE.ASSIGNMENT.EXPORT_OK' })
    })

    it('should display error msg when export fails', () => {
      const errorResponse = { error: 'Error on exporting permissions', status: 400 }
      assgnmtApiSpy.exportAssignments.and.returnValue(throwError(() => errorResponse))
      spyOn(console, 'error')
      const selectedNames = ['Product1', 'Product2']
      component.selectedProductNames = selectedNames

      component.onExportConfirmation()

      expect(msgServiceSpy.error).toHaveBeenCalledWith({ summaryKey: 'ACTIONS.EXPORT.MESSAGE.ASSIGNMENT.EXPORT_NOK' })
      expect(console.error).toHaveBeenCalledWith('exportAssignments', errorResponse)
    })
  })

  it('should reset displayExportDialog, selectedResults, and selectedProductNames', () => {
    spyOn(component.displayExportDialogChange, 'emit')
    component.selectedProductNames = ['Product1']

    component.onCloseExportDialog()

    expect(component.displayExportDialogChange.emit).toHaveBeenCalledWith(false)
    expect(component.selectedProductNames).toEqual([])
  })
})
