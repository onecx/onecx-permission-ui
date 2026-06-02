import { Component, EventEmitter, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'
import { ButtonModule } from 'primeng/button'
import { DialogModule } from 'primeng/dialog'
import { TooltipModule } from 'primeng/tooltip'

import { PortalMessageService } from '@onecx/angular-integration-interface'

import { PermissionAPIService } from 'src/app/shared/generated'
import type { PermissionViewRow } from 'src/app/permission/app-detail/app-detail.component'

@Component({
  selector: 'app-permission-delete',
  standalone: true,
  imports: [CommonModule, TranslateModule, DialogModule, ButtonModule, TooltipModule],
  templateUrl: './permission-delete.component.html',
  styleUrls: ['./permission-delete.component.scss']
})
export class PermissionDeleteComponent {
  @Input() permission: PermissionViewRow | undefined
  @Input() displayDeleteDialog = false
  @Output() dataChanged: EventEmitter<boolean> = new EventEmitter()

  constructor(
    private readonly permApi: PermissionAPIService,
    private readonly msgService: PortalMessageService
  ) {}

  public onClose(): void {
    this.dataChanged.emit(false)
  }

  public onDeleteConfirmation(): void {
    if (!this.permission?.id) return
    this.permApi.deletePermission({ id: this.permission.id }).subscribe({
      next: () => {
        this.msgService.success({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_OK' })
        this.dataChanged.emit(true)
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_NOK' })
        console.error('deletePermission', err)
      }
    })
  }
}
