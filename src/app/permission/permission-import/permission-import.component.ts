import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'

import { ButtonModule } from 'primeng/button'
import { DialogModule } from 'primeng/dialog'
import { FileSelectEvent, FileUpload, FileUploadModule } from 'primeng/fileupload'
import { MessageModule } from 'primeng/message'
import { TooltipModule } from 'primeng/tooltip'

import { PortalMessageService } from '@onecx/angular-integration-interface'

import { AssignmentAPIService, Permission } from 'src/app/shared/generated'

export type ImportError = {
  name: string
  message: string
  error: any
  ok: boolean
  status: number
  statusText: string
  exceptionKey: string
}

@Component({
  selector: 'app-permission-import',
  standalone: true,
  imports: [CommonModule, TranslateModule, DialogModule, FileUploadModule, ButtonModule, TooltipModule, MessageModule],
  templateUrl: './permission-import.component.html'
})
export class PermissionImportComponent {
  @Input() displayImportDialog = false
  @Output() displayImportDialogChange = new EventEmitter<boolean>()
  @Output() importDone = new EventEmitter<void>()

  public importError: ImportError | undefined = undefined
  public importAssignmentItem: Permission | null = null

  @ViewChild(FileUpload) fileUploader: FileUpload | undefined

  constructor(
    private readonly assgnmtApi: AssignmentAPIService,
    private readonly msgService: PortalMessageService
  ) {}

  public onImportFileSelect(event: FileSelectEvent): void {
    this.importError = undefined
    event.files[0].text().then((text) => {
      try {
        const importPermission = JSON.parse(text)
        this.importAssignmentItem = importPermission
      } catch (err) {
        console.error('Import parse error', err)
        this.importError = {
          name: 'Parse error',
          ok: false,
          status: 400,
          statusText: 'Parser error',
          message: '',
          error: { errorCode: 'PARSER', detail: err },
          exceptionKey: 'ACTIONS.IMPORT.ERROR.PARSER'
        }
      }
    })
  }

  public onImportConfirmation(): void {
    if (this.importAssignmentItem) {
      this.importError = undefined
      this.assgnmtApi.importAssignments({ body: this.importAssignmentItem }).subscribe({
        next: () => {
          this.displayImportDialogChange.emit(false)
          this.msgService.success({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.OK' })
          this.importDone.emit()
        },
        error: (err) => {
          console.error('importAssignments', err)
          this.importError = { ...err, exceptionKey: 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.PERMISSIONS' }
          this.msgService.error({ summaryKey: 'ACTIONS.IMPORT.MESSAGE.NOK' })
        }
      })
    }
  }

  public onCloseImportDialog(): void {
    this.displayImportDialogChange.emit(false)
    this.importError = undefined
    this.fileUploader?.clear()
  }

  public onImportClear(): void {
    this.importError = undefined
  }
}
