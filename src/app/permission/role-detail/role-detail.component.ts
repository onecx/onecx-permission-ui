import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core'
import { FormGroup, FormControl, Validators } from '@angular/forms'
import { TranslateService } from '@ngx-translate/core'
import { catchError, finalize, map, of, Observable } from 'rxjs'

import { PortalMessageService, UserService } from '@onecx/portal-integration-angular'

import { Role, CreateRoleRequest, IAMRole, UpdateRoleRequest, RoleAPIService } from 'src/app/shared/generated'
import { App, ChangeMode } from 'src/app/permission/app-detail/app-detail.component'

@Component({
  selector: 'app-role-detail',
  templateUrl: './role-detail.component.html',
  styleUrls: ['./role-detail.component.scss']
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
  public loadingExceptionKey: string | undefined = undefined
  public myPermissions = new Array<string>() // permissions of the user
  public formGroupRole: FormGroup
  public iamRoles$!: Observable<IAMRole[]>
  public selectedIamRoles: IAMRole[] = []

  constructor(
    private readonly roleApi: RoleAPIService,
    private readonly translate: TranslateService,
    private readonly msgService: PortalMessageService,
    private readonly userService: UserService
  ) {
    if (userService.hasPermission('ROLE#EDIT')) this.myPermissions.push('ROLE#EDIT')
    if (userService.hasPermission('ROLE#DELETE')) this.myPermissions.push('ROLE#DELETE')
    this.formGroupRole = new FormGroup({
      id: new FormControl(null),
      name: new FormControl(null, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      description: new FormControl(null)
    })
  }

  public ngOnChanges(): void {
    this.formGroupRole.reset()
    if (this.changeMode === 'EDIT' && this.role) {
      this.formGroupRole.controls['name'].patchValue(this.role.name)
      this.formGroupRole.controls['description'].patchValue(this.role.description)
    }
    this.searchIamRoles()
  }

  public onClose(): void {
    this.dataChanged.emit(false)
  }

  /**
   * Save a ROLE
   */
  public onSaveRole(): void {
    if (!this.formGroupRole.valid) {
      console.info('form not valid')
      return
    }
    let roleExists = false
    if (this.roles.length > 0) {
      let roles = this.roles.filter((r) => r.name === this.formGroupRole.controls['name'].value)
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
      console.info('form valid ' + this.changeMode)
      const role = {
        name: this.formGroupRole.controls['name'].value,
        description: this.formGroupRole.controls['description'].value
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
            console.error(err)
          }
        })
    } else {
      const role = {
        modificationCount: this.role?.modificationCount,
        name: this.formGroupRole.controls['name'].value,
        description: this.formGroupRole.controls['description'].value
      } as UpdateRoleRequest
      this.roleApi.updateRole({ id: this.role?.id ?? '', updateRoleRequest: role }).subscribe({
        next: () => {
          this.msgService.success({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_OK' })
          this.dataChanged.emit(true)
        },
        error: (err) => {
          this.msgService.error({ summaryKey: 'ACTIONS.EDIT.MESSAGE.ROLE_NOK' })
          console.error(err)
        }
      })
    }
  }

  /**
   * Delete a ROLE
   */
  public onDeleteConfirmation() {
    this.roleApi.deleteRole({ id: this.role?.id ?? '' }).subscribe({
      next: () => {
        this.msgService.success({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_OK' })
        this.dataChanged.emit(true)
      },
      error: (err) => {
        this.msgService.error({ summaryKey: 'ACTIONS.DELETE.MESSAGE.ROLE_NOK' })
        console.error(err.error)
      }
    })
  }

  /**
   * Select IAM Roles to be added
   */
  public searchIamRoles(): void {
    this.loading = true
    this.selectedIamRoles = []
    this.iamRoles$ = this.roleApi.searchAvailableRoles({ iAMRoleSearchCriteria: { pageSize: 1000 } }).pipe(
      catchError((err) => {
        this.loadingExceptionKey = 'EXCEPTIONS.HTTP_STATUS_' + err.status + '.ROLES'
        console.error('searchAvailableRoles():', err)
        return of([])
      }),
      map((result: any) => {
        return result.stream ?? []
      }),
      finalize(() => (this.loading = false))
    )
  }
  public sortRoleByName(a: IAMRole, b: IAMRole): number {
    return (a.name ? a.name.toUpperCase() : '').localeCompare(b.name ? b.name.toUpperCase() : '')
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
          console.error(err)
        }
      })
    else this.dataChanged.emit(false)
  }
}
