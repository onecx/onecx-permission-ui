import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { ButtonModule } from 'primeng/button'
import { DialogModule } from 'primeng/dialog'
import { ListboxModule } from 'primeng/listbox'
import { MessageModule } from 'primeng/message'
import { TooltipModule } from 'primeng/tooltip'

import { AngularRemoteComponentsModule, SLOT_SERVICE, SlotService } from '@onecx/angular-remote-components'
import { PortalMessageService } from '@onecx/angular-integration-interface'

import { Role, RoleAPIService } from 'src/app/shared/generated'

export function slotInitializer(slotService: SlotService) {
  return () => slotService.init()
}
export type IDMRole = { name?: string } // replica from a IAM role

@Component({
  selector: 'app-role-idm',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    DialogModule,
    ListboxModule,
    MessageModule,
    ButtonModule,
    TooltipModule,
    AngularRemoteComponentsModule
  ],
  templateUrl: './role-idm.component.html',
  styleUrls: ['./role-idm.component.scss'],
  providers: [{ provide: SLOT_SERVICE, useExisting: SlotService }]
})
export class RoleIdmComponent implements OnInit, OnChanges {
  @Input() roles: Role[] = []
  @Input() visible = false
  @Output() dataChanged: EventEmitter<boolean> = new EventEmitter()

  public loading = true
  public exceptionKey: string | undefined = undefined
  public idmRoles: IDMRole[] = []
  public idmRolesOrg: IDMRole[] = []
  public idmRolesSelected: IDMRole[] = []

  // manage slot to get roles from iam
  public isComponentDefined = false
  public slotName = 'onecx-permission-iam-user-roles'
  public roleListEmitter = new EventEmitter<IDMRole[]>()

  constructor(
    private readonly roleApi: RoleAPIService,
    private readonly msgService: PortalMessageService,
    private readonly slotService: SlotService
  ) {}

  public ngOnInit(): void {
    slotInitializer(this.slotService)()
  }

  public ngOnChanges(): void {
    if (this.visible) {
      if (this.isComponentDefined) {
        // refresh missing roles
        this.idmRoles = this.idmRolesOrg.filter((l) => this.roles.filter((r) => r.name === l.name).length === 0)
      } else {
        // check if the IAM component is assigned to the slot
        this.slotService.isSomeComponentDefinedForSlot(this.slotName).subscribe((def) => {
          this.isComponentDefined = def
          if (this.isComponentDefined) this.prepareRoleListEmitter()
        })
      }
    }
  }

  // Hommage to SonarCloud: separate this
  private prepareRoleListEmitter() {
    this.loading = true
    // after 5s we assume IAM product is not running
    setTimeout(() => {
      if (this.loading) this.loading = false
    }, 5000)

    // receive data from remote component
    this.roleListEmitter.subscribe((list) => {
      this.loading = false
      // exclude roles which already exists in Permission Mgmt
      this.idmRolesOrg = list
      this.idmRoles = this.idmRolesOrg.filter((l) => this.roles.filter((r) => r.name === l.name).length === 0)
    })
  }

  public onAddIamRoles() {
    if (this.idmRolesSelected.length > 0)
      this.roleApi.createRole({ createRolesRequest: { roles: this.idmRolesSelected } }).subscribe({
        next: () => {
          this.idmRolesSelected = []
          this.msgService.success({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_OK' })
          this.dataChanged.emit(true)
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'ACTIONS.CREATE.MESSAGE.ROLE_NOK' })
          console.error('createRole', err)
        }
      })
    else this.dataChanged.emit(false)
  }
}
