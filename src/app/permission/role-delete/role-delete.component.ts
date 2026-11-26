import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'

import { ButtonModule } from 'primeng/button'
import { DialogModule } from 'primeng/dialog'
import { MessageModule } from 'primeng/message'
import { TooltipModule } from 'primeng/tooltip'

import { PortalMessageService } from '@onecx/angular-integration-interface'

import { RoleAPIService } from 'src/app/shared/generated'
import { PermissionRole } from 'src/app/permission/app-detail/app-detail.component'

@Component({
  selector: 'app-role-delete',
  standalone: true,
  imports: [ButtonModule, DialogModule, MessageModule, TooltipModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-delete.component.html',
  styleUrl: './role-delete.component.scss'
})
export class RoleDeleteComponent {
  private readonly roleApi = inject(RoleAPIService)
  private readonly msgService = inject(PortalMessageService)

  @Input() role: PermissionRole | undefined
  @Input() visible = false
  @Output() dataChanged: EventEmitter<boolean> = new EventEmitter()

  public onDeleteConfirmation(): void {
    if (!this.role?.id) return
    this.roleApi.deleteRole({ id: this.role.id }).subscribe({
      next: () => {
        this.msgService.success({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_OK' })
        this.dataChanged.emit(true)
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_NOK' })
        console.error('deleteRole', err)
      }
    })
  }
}
