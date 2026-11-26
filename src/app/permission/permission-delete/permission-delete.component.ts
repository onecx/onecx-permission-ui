import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core'
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
  imports: [ButtonModule, DialogModule, TooltipModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permission-delete.component.html',
  styleUrl: './permission-delete.component.scss'
})
export class PermissionDeleteComponent {
  private readonly permApi = inject(PermissionAPIService)
  private readonly msgService = inject(PortalMessageService)

  @Input() permission: PermissionViewRow | undefined
  @Input() visible = false
  @Output() dataChanged: EventEmitter<boolean> = new EventEmitter()

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
