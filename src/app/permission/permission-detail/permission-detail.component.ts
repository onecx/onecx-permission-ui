import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { TranslateService } from '@ngx-translate/core'

import { PortalMessageService, UserService } from '@onecx/portal-integration-angular'

import { /* CreateRoleRequest, UpdateRoleRequest, */ PermissionAPIService, Permission } from 'src/app/shared/generated'
import { App, ChangeMode, PermissionViewRow } from 'src/app/permission/app-detail/app-detail.component'

@Component({
  selector: 'app-permission-detail',
  templateUrl: './permission-detail.component.html'
})
export class PermissionDetailComponent implements OnChanges {
  @Input() currentApp!: App
  @Input() permission: PermissionViewRow | undefined
  @Input() permissions: Permission[] = []
  @Input() changeMode: ChangeMode = 'VIEW'
  @Input() displayDetailDialog = false
  @Input() displayDeleteDialog = false
  @Output() dataChanged: EventEmitter<boolean> = new EventEmitter()

  public myPermissions = new Array<string>() // permissions of the user
  public formGroup: FormGroup

  constructor(
    private permApi: PermissionAPIService,
    private translate: TranslateService,
    private msgService: PortalMessageService,
    private userService: UserService
  ) {
    if (userService.hasPermission('PERMISSION#EDIT')) this.myPermissions.push('PERMISSION#EDIT')
    if (userService.hasPermission('PERMISSION#DELETE')) this.myPermissions.push('PERMISSION#DELETE')
    this.formGroup = new FormGroup({
      appId: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      productName: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      description: new FormControl(null),
      resource: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      action: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)])
    })
  }

  public ngOnChanges(): void {
    this.formGroup.reset()
    if (this.changeMode === 'EDIT' && this.permission) {
      this.formGroup.controls['appId'].patchValue(this.permission.appId)
      this.formGroup.controls['productName'].patchValue(this.permission.productName)
      this.formGroup.controls['resource'].patchValue(this.permission.resource)
      this.formGroup.controls['action'].patchValue(this.permission.action)
      this.formGroup.controls['description'].patchValue(this.permission.description)
    }
  }

  public onClose(): void {
    this.dataChanged.emit(false)
  }

  /**
   * Save a PERMISSION
   */
  public onSave(): void {
    if (!this.formGroup.valid) {
      console.info('form not valid')
      return
    }
    let permissionExists = false
    if (this.permissions.length > 0) {
      let permissions = this.permissions.filter((p) => p.resource === this.formGroup.controls['resource'].value)
      if (this.changeMode !== 'CREATE') permissions = permissions.filter((r) => r.id !== this.permission?.id)
      permissionExists = permissions.length > 0
    }
    if (permissionExists) {
      this.msgService.error({
        summaryKey: 'ACTIONS.' + this.changeMode + '.PERMISSION',
        detailKey: 'VALIDATION.ERRORS.PERMISSION.' + this.changeMode + '_ALREADY_EXISTS'
      })
      return
    }
    if (this.changeMode === 'CREATE') {
      console.info('form valid ' + this.changeMode)
      /*       const permission = {
        appId: this.formGroup.controls['appId'].value,
        productName: this.formGroup.controls['productName'].value,
        resource: this.formGroup.controls['resource'].value,
        action: this.formGroup.controls['action'].value,
        description: this.formGroup.controls['description'].value
      } as CreateRoleRequest

      this.permApi.createPermission({
          createRolesRequest: { permissions: [permission] }
        })
        .subscribe({
          next: () => {
            this.msgService.success({ summaryKey: 'ACTIONS.' + this.changeMode + '.MESSAGE.PERMISSION_OK' })
            this.dataChanged.emit(true)
          },
          error: (err) => {
            this.msgService.error({ summaryKey: 'ACTIONS.' + this.changeMode + '.MESSAGE.PERMISSION_NOK' })
            console.error(err)
          }
        })
 */
    } else {
      //const roleNameChanged = this.formGroup.controls['name'].value !== this.permission?.name
      /*       const permission = {
        modificationCount: this.permission?.modificationCount,
        appId: this.formGroup.controls['appId'].value,
        productName: this.formGroup.controls['productName'].value,
        resource: this.formGroup.controls['resource'].value,
        action: this.formGroup.controls['action'].value,
        description: this.formGroup.controls['description'].value
      } as UpdateRoleRequest
 */
      /* this.permApi.updatePermission({ id: this.permission?.id ?? '', updateRoleRequest: permission }).subscribe({
        next: () => {
          this.msgService.success({ summaryKey: 'ACTIONS.EDIT.MESSAGE.PERMISSION_OK' })
          this.dataChanged.emit(roleNameChanged)
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'ACTIONS.EDIT.MESSAGE.PERMISSION_NOK' })
          console.error(err)
        }
      })
 */
    }
  }

  public onDeleteConfirmation() {
    /*     this.permApi.deletePermission({ id: this.permission?.id ?? '' }).subscribe({
      next: () => {
        this.msgService.success({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_OK' })
        this.dataChanged.emit(true)
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'ACTIONS.DELETE.MESSAGE.PERMISSION_NOK' })
        console.error(err.error)
      }
    })
 */
  }
}
