import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { errorTailorImports } from '@ngneat/error-tailor'
import { ButtonModule } from 'primeng/button'
import { DialogModule } from 'primeng/dialog'
import { FloatLabelModule } from 'primeng/floatlabel'
import { InputTextModule } from 'primeng/inputtext'
import { TooltipModule } from 'primeng/tooltip'

import { PortalMessageService } from '@onecx/angular-integration-interface'

import { CreateRoleRequest, Role, RoleAPIService, UpdateRoleRequest } from 'src/app/shared/generated'
import type { App, ChangeMode } from 'src/app/permission/app-detail/app-detail.component'

@Component({
  selector: 'app-role-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    errorTailorImports,
    DialogModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule,
    TooltipModule
  ],
  templateUrl: './role-detail.component.html',
  styleUrls: ['./role-detail.component.scss']
})
export class RoleDetailComponent implements OnChanges {
  @Input() currentApp!: App
  @Input() role: Role | undefined
  @Input() roles: Role[] = []
  @Input() changeMode: ChangeMode = 'VIEW'
  @Input() displayDetailDialog = false
  @Output() dataChanged: EventEmitter<boolean> = new EventEmitter()

  public formGroup: FormGroup

  constructor(
    private readonly roleApi: RoleAPIService,
    private readonly translate: TranslateService,
    private readonly msgService: PortalMessageService
  ) {
    this.formGroup = new FormGroup({
      id: new FormControl(null),
      name: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      description: new FormControl(null)
    })
  }

  public ngOnChanges(): void {
    this.formGroup.reset()
    if (this.changeMode === 'EDIT' && this.role) {
      this.formGroup.controls['name'].patchValue(this.role.name)
      this.formGroup.controls['description'].patchValue(this.role.description)
    }
  }

  /**
   * Save a ROLE
   */
  public onSaveRole(): void {
    if (!this.formGroup.valid) {
      console.info('form not valid')
      return
    }
    let roleExists = false
    if (this.roles.length > 0) {
      let roles = this.roles.filter((r) => r.name === this.formGroup.controls['name'].value)
      if (this.changeMode !== 'CREATE') roles = roles.filter((r) => r.id !== this.role?.id)
      roleExists = roles.length > 0
    }
    if (roleExists) {
      this.msgService.error({
        summaryKey: 'ACTIONS.' + this.changeMode + '.ROLE',
        detailKey: 'VALIDATION.ERRORS.ROLE.' + this.changeMode + '_ALREADY_EXISTS'
      })
      return
    }
    if (this.changeMode === 'CREATE') {
      const role = {
        name: this.formGroup.controls['name'].value,
        description: this.formGroup.controls['description'].value
      } as CreateRoleRequest
      this.roleApi
        .createRole({
          createRolesRequest: { roles: [role] }
        })
        .subscribe({
          next: () => {
            this.msgService.success({ summaryKey: 'ACTIONS.' + this.changeMode + '.MESSAGE.ROLE_OK' })
            this.dataChanged.emit(true)
          },
          error: (err) => {
            this.msgService.error({ summaryKey: 'ACTIONS.' + this.changeMode + '.MESSAGE.ROLE_NOK' })
            console.error('createRole', err)
          }
        })
    } else {
      const role = {
        modificationCount: this.role?.modificationCount,
        name: this.formGroup.controls['name'].value,
        description: this.formGroup.controls['description'].value
      } as UpdateRoleRequest
      this.roleApi.updateRole({ id: this.role?.id ?? '', updateRoleRequest: role }).subscribe({
        next: () => {
          this.msgService.success({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_OK' })
          this.dataChanged.emit(true)
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_NOK' })
          console.error('updateRole', err)
        }
      })
    }
  }
}
