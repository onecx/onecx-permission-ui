import { APP_INITIALIZER, Component, EventEmitter, Input, Output, OnChanges } from '@angular/core'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { TranslateService } from '@ngx-translate/core'
import { of, Observable } from 'rxjs'

import { PortalMessageService, UserService } from '@onecx/portal-integration-angular'
import { SLOT_SERVICE, SlotService } from '@onecx/angular-remote-components'

import { Role, CreateRoleRequest, IAMRole, UpdateRoleRequest, RoleAPIService } from 'src/app/shared/generated'
import { App, ChangeMode } from 'src/app/permission/app-detail/app-detail.component'

export function slotInitializer(slotService: SlotService) {
  return () => slotService.init()
}

@Component({
  selector: 'app-role-detail',
  templateUrl: './role-detail.component.html',
  styleUrls: ['./role-detail.component.scss'],
  providers: [
    { provide: APP_INITIALIZER, useFactory: slotInitializer, deps: [SLOT_SERVICE], multi: true },
    { provide: SLOT_SERVICE, useExisting: SlotService }
  ]
})
export class RoleDetailComponent implements OnChanges {
  @Input() currentApp!: App
  @Input() role: Role | undefined
  @Input() roles: Role[] = []
  @Input() changeMode: ChangeMode = 'VIEW'
  @Input() displayDetailDialog = false
  @Input() displayDeleteDialog = false
  @Input() showIamRolesDialog = false
  @Output() dataChanged: EventEmitter<boolean> = new EventEmitter()

  public loading = true
  public exceptionKey: string | undefined = undefined
  public formGroup: FormGroup
  public iamRoles$!: Observable<IAMRole[]>
  public selectedIamRoles: IAMRole[] = []

  // manage slot to get roles from iam
  public loadingIamRoles = false
  public isComponentDefined = false
  public slotName = 'onecx-permission-iam-user-roles'
  public roleListEmitter = new EventEmitter<IAMRole[]>()
  public componentPermissions: string[] = []

  constructor(
    private readonly roleApi: RoleAPIService,
    private readonly translate: TranslateService,
    private readonly msgService: PortalMessageService,
    private readonly slotService: SlotService,
    private readonly userService: UserService
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
    // initialize receiving data - once
    if (this.showIamRolesDialog && !this.isComponentDefined) {
      // check if the IAM component is assigned to the slot
      this.slotService.isSomeComponentDefinedForSlot(this.slotName).subscribe((def) => {
        this.isComponentDefined = def
        this.loading = true
        if (this.isComponentDefined) this.prepareRoleListEmitter()
      })
    }
  }
  // Hommage to SonarCloud: separate this
  private prepareRoleListEmitter() {
    // receive data from remote component
    this.roleListEmitter.subscribe((list) => {
      this.loading = false
      // exclude roles which already exists in Permission Mgmt
      this.iamRoles$ = of(list.filter((l) => this.roles.filter((r) => r.name === l.name).length === 0))
    })
  }

  public onClose(): void {
    this.dataChanged.emit(false)
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

  /**
   * Delete a ROLE
   */
  public onDeleteConfirmation() {
    if (!this.role?.id) return
    this.roleApi.deleteRole({ id: this.role?.id }).subscribe({
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

  public onAddIamRoles() {
    if (this.selectedIamRoles.length > 0)
      this.roleApi.createRole({ createRolesRequest: { roles: this.selectedIamRoles } }).subscribe({
        next: () => {
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
