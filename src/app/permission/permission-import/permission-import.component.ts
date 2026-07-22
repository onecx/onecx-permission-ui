import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  ViewChild
} from '@angular/core'
import { HttpErrorResponse } from '@angular/common/http'
import { TranslateModule } from '@ngx-translate/core'

import { ButtonModule } from 'primeng/button'
import { DialogModule } from 'primeng/dialog'
import { FileSelectEvent, FileUpload, FileUploadModule } from 'primeng/fileupload'
import { MessageModule } from 'primeng/message'
import { TooltipModule } from 'primeng/tooltip'

import { PortalMessageService } from '@onecx/angular-integration-interface'

import { AssignmentAPIService } from 'src/app/shared/generated'

// assignments in import file are structured as follows:
interface Role {
  // role name
  [key: string]: {
    // object: action[]
    [key: string]: string[]
  }
}
interface MicroService {
  [key: string]: Role
}
interface Product {
  [key: string]: MicroService
}
export interface AssignmentSnapshot {
  id?: string
  created?: string
  assignments: {
    [key: string]: Product
  }
}

export type ImportErrorDetail = {
  detail?: string
  errorCode?: string
  invalidParams?: { name: string; message: string }[]
}
export type ImportError = {
  name: string
  message: string
  error: ImportErrorDetail | null
  ok: boolean
  status: number
  statusText: string
  exceptionKey: string
}

@Component({
  selector: 'app-permission-import',
  standalone: true,
  imports: [ButtonModule, DialogModule, FileUploadModule, MessageModule, TooltipModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permission-import.component.html'
})
export class PermissionImportComponent {
  private readonly cd = inject(ChangeDetectorRef)
  private readonly assgnmtApi = inject(AssignmentAPIService)
  private readonly msgService = inject(PortalMessageService)
  // in/out properties
  @Input() displayImportDialog = false
  @Output() displayImportDialogChange = new EventEmitter<boolean>()
  @Output() importDone = new EventEmitter<void>()

  public importError: ImportError | undefined = undefined
  public importSnapshot: AssignmentSnapshot | undefined = undefined

  @ViewChild(FileUpload) fileUploader: FileUpload | undefined

  public onImportFileSelect(event: FileSelectEvent): void {
    this.importError = undefined
    event.files[0].text().then((text) => {
      try {
        this.importSnapshot = JSON.parse(text)
        if (!this.isAssignmentSnapshot(this.importSnapshot)) {
          console.error('Assignment Import Error: not valid data ')
          this.importError = {
            name: 'Invalid data',
            ok: false,
            status: 400,
            statusText: 'Invalid data',
            message: '',
            error: { errorCode: 'CONTENT' },
            exceptionKey: 'VALIDATION.ERRORS.IMPORT_CONTENT_ERROR'
          }
        }
      } catch (err) {
        console.error('Assignment Import Error: parse error', err)
        this.importError = {
          name: 'Parse error',
          ok: false,
          status: 400,
          statusText: 'Parser error',
          message: '',
          error: { errorCode: 'PARSER', detail: err instanceof Error ? err.message : String(err) },
          exceptionKey: 'VALIDATION.ERRORS.IMPORT_GENERAL_ERROR'
        }
      } finally {
        this.cd.detectChanges()
      }
    })
  }

  public onImportConfirmation(): void {
    if (this.importSnapshot) {
      this.importError = undefined
      this.assgnmtApi.importAssignments({ body: this.importSnapshot }).subscribe({
        next: () => {
          this.displayImportDialogChange.emit(false)
          this.msgService.success({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.OK' })
          this.importDone.emit()
        },
        error: (err: HttpErrorResponse) => {
          console.error('importSnapshot', err)
          this.importError = {
            ...err,
            error: err.error as ImportErrorDetail | null,
            exceptionKey: 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS'
          }
          this.msgService.error({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.NOK' })
        }
      })
    }
  }

  public onCloseImportDialog(): void {
    this.displayImportDialogChange.emit(false)
    this.importError = undefined
    this.importSnapshot = undefined
    this.fileUploader?.clear()
  }

  public onImportClear(): void {
    this.importError = undefined
  }

  private isAssignmentSnapshot(obj: unknown): obj is AssignmentSnapshot {
    const snapshot = obj as AssignmentSnapshot
    return !!(typeof snapshot === 'object' && snapshot?.assignments)
  }
}
