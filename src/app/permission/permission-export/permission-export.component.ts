import { Component, EventEmitter, Input, Output } from '@angular/core'
import FileSaver from 'file-saver'

import { PortalMessageService } from '@onecx/angular-integration-interface'

import { AssignmentAPIService } from 'src/app/shared/generated'
import { getCurrentDateTime } from 'src/app/shared/utils'

@Component({
  selector: 'app-permission-export',
  templateUrl: './permission-export.component.html',
  styleUrls: ['./permission-export.component.scss']
})
export class PermissionExportComponent {
  @Input() products: string[] = []
  @Input() displayExportDialog = false
  @Input() listedProductsHeaderKey = ''
  @Output() displayExportDialogChange = new EventEmitter<boolean>()

  public selectedProductNames: string[] = []

  constructor(
    private readonly assgnmtApi: AssignmentAPIService,
    private readonly msgService: PortalMessageService
  ) {}

  public onExportConfirmation(): void {
    if (this.selectedProductNames.length > 0) {
      this.assgnmtApi
        .exportAssignments({ exportAssignmentsRequest: { productNames: this.selectedProductNames } })
        .subscribe({
          next: (item) => {
            const permissionsJson = JSON.stringify(item, null, 2)
            FileSaver.saveAs(
              new Blob([permissionsJson], { type: 'text/json' }),
              'onecx-permissions_' + getCurrentDateTime() + '.json'
            )
            this.msgService.success({ summaryKey: 'ACTIONS.EXPORT.MESSAGE.ASSIGNMENT.EXPORT_OK' })
            this.selectedProductNames = []
          },
          error: (err) => {
            this.msgService.error({ summaryKey: 'ACTIONS.EXPORT.MESSAGE.ASSIGNMENT.EXPORT_NOK' })
            console.error(err)
          }
        })
      this.displayExportDialogChange.emit(false)
    }
  }

  public onCloseExportDialog(): void {
    this.displayExportDialogChange.emit(false)
    this.selectedProductNames = []
  }
}
