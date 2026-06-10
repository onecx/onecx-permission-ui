import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'

import { AutoCompleteModule } from 'primeng/autocomplete'
import { ButtonModule } from 'primeng/button'
import { CardModule } from 'primeng/card'
import { CheckboxModule } from 'primeng/checkbox'
import { ConfirmDialogModule } from 'primeng/confirmdialog'
import { ConfirmPopupModule } from 'primeng/confirmpopup'
import { ConfirmationService } from 'primeng/api'
import { DialogModule } from 'primeng/dialog'
import { FileUploadModule } from 'primeng/fileupload'
import { FloatLabelModule } from 'primeng/floatlabel'
import { InputGroupModule } from 'primeng/inputgroup'
import { InputGroupAddonModule } from 'primeng/inputgroupaddon'
import { InputTextModule } from 'primeng/inputtext'
import { KeyFilterModule } from 'primeng/keyfilter'
import { ListboxModule } from 'primeng/listbox'
import { MessageModule } from 'primeng/message'
import { MultiSelectModule } from 'primeng/multiselect'
import { SelectButtonModule } from 'primeng/selectbutton'
import { SelectModule } from 'primeng/select'
import { TableModule } from 'primeng/table'
import { TabsModule } from 'primeng/tabs'
import { TextareaModule } from 'primeng/textarea'
import { ToastModule } from 'primeng/toast'
import { TooltipModule } from 'primeng/tooltip'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'

import { LabelResolver } from './label.resolver'
import { OcxChipComponent } from './ocx-chip/ocx-chip.component'

@NgModule({
  imports: [
    OcxChipComponent,
    AngularAcceleratorModule,
    AutoCompleteModule,
    CheckboxModule,
    ButtonModule,
    CardModule,
    CommonModule,
    ConfirmDialogModule,
    ConfirmPopupModule,
    DialogModule,
    FileUploadModule,
    FloatLabelModule,
    FormsModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputTextModule,
    KeyFilterModule,
    ListboxModule,
    MessageModule,
    MultiSelectModule,
    ReactiveFormsModule,
    SelectModule,
    SelectButtonModule,
    TableModule,
    TabsModule,
    TextareaModule,
    ToastModule,
    TooltipModule,
    TranslateModule
  ],
  exports: [
    OcxChipComponent,
    AutoCompleteModule,
    ButtonModule,
    CardModule,
    CheckboxModule,
    CommonModule,
    ConfirmDialogModule,
    ConfirmPopupModule,
    DialogModule,
    FileUploadModule,
    FloatLabelModule,
    FormsModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputTextModule,
    KeyFilterModule,
    ListboxModule,
    MessageModule,
    MultiSelectModule,
    ReactiveFormsModule,
    SelectModule,
    SelectButtonModule,
    TableModule,
    TabsModule,
    TextareaModule,
    ToastModule,
    TooltipModule,
    TranslateModule
  ],
  providers: [ConfirmationService, LabelResolver]
})
export class SharedModule {}
