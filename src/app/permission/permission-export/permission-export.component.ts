import { Component, EventEmitter, Input, Output, SimpleChanges, OnChanges } from '@angular/core'
import FileSaver from 'file-saver'

import { getCurrentDateTime, sortByLocale } from 'src/app/shared/utils'
import { AssignmentAPIService } from 'src/app/shared/generated'
import { PortalMessageService } from '@onecx/angular-integration-interface'
import { App } from '../app-search/app-search.component'
import { RowListGridData } from '@onecx/angular-accelerator'

@Component({
  selector: 'app-permission-export',
  templateUrl: './permission-export.component.html',
  styleUrls: ['./permission-export.component.scss']
})
export class PermissionExportComponent implements OnChanges {
  @Input() products: any
  @Input() displayExportDialog = false
  @Output() displayExportDialogChange = new EventEmitter()
  public selectedProductNames: string[] = []

  constructor(
    private assgnmtApi: AssignmentAPIService,
    private msgService: PortalMessageService
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['displayExportDialog'] && !changes['displayExportDialog'].currentValue) {
      this.selectedProductNames = []
    }
  }

  public extractProductNames(products: (App & RowListGridData)[]): string[] {
    return Array.from(products.map((p) => p.displayName ?? '')).sort(sortByLocale)
  }
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
            this.displayExportDialogChange.emit(false)
            this.selectedProductNames = []
          },
          error: (err) => {
            this.msgService.error({ summaryKey: 'ACTIONS.EXPORT.MESSAGE.ASSIGNMENT.EXPORT_NOK' })
            console.error(err)
          }
        })
    }
  }
  public onCloseExportDialog(): void {
    this.displayExportDialogChange.emit(false)
    this.selectedProductNames = []
  }
}
