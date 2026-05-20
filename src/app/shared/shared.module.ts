import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { TranslateModule, TranslateService } from '@ngx-translate/core'
import { provideErrorTailorConfig } from '@ngneat/error-tailor'

import { AutoCompleteModule } from 'primeng/autocomplete'
import { CheckboxModule } from 'primeng/checkbox'
import { ButtonModule } from 'primeng/button'
import { ConfirmDialogModule } from 'primeng/confirmdialog'
import { ConfirmPopupModule } from 'primeng/confirmpopup'
import { ConfirmationService } from 'primeng/api'
import { DialogModule } from 'primeng/dialog'
import { SelectModule } from 'primeng/select'
import { FileUploadModule } from 'primeng/fileupload'
import { InputTextModule } from 'primeng/inputtext'
import { TextareaModule } from 'primeng/textarea'
import { KeyFilterModule } from 'primeng/keyfilter'
import { ListboxModule } from 'primeng/listbox'
import { MultiSelectModule } from 'primeng/multiselect'
import { MessageModule } from 'primeng/message'
import { SelectButtonModule } from 'primeng/selectbutton'
import { TableModule } from 'primeng/table'
import { TabsModule } from 'primeng/tabs'
import { ToastModule } from 'primeng/toast'
import { TooltipModule } from 'primeng/tooltip'

import { AngularAcceleratorModule } from '@onecx/angular-accelerator'

import { LabelResolver } from './label.resolver'
import { OcxChipComponent } from './ocx-chip/ocx-chip.component'

@NgModule({
  declarations: [OcxChipComponent],
  imports: [
    AngularAcceleratorModule,
    AutoCompleteModule,
    CheckboxModule,
    ButtonModule,
    CommonModule,
    ConfirmDialogModule,
    ConfirmPopupModule,
    DialogModule,
    SelectModule,
    FileUploadModule,
    FormsModule,
    InputTextModule,
    TextareaModule,
    KeyFilterModule,
    ListboxModule,
    MessageModule,
    MultiSelectModule,
    ReactiveFormsModule,
    SelectButtonModule,
    TableModule,
    TabsModule,
    ToastModule,
    TooltipModule,
    TranslateModule
  ],
  exports: [
    AutoCompleteModule,
    CheckboxModule,
    ButtonModule,
    CommonModule,
    ConfirmDialogModule,
    ConfirmPopupModule,
    DialogModule,
    SelectModule,
    FileUploadModule,
    FormsModule,
    InputTextModule,
    TextareaModule,
    KeyFilterModule,
    ListboxModule,
    MessageModule,
    MultiSelectModule,
    ReactiveFormsModule,
    SelectButtonModule,
    TableModule,
    TabsModule,
    ToastModule,
    TooltipModule,
    TranslateModule,
    OcxChipComponent
  ],
  //this is not elegant, for some reason the injection token from primeng does not work across federated module
  providers: [
    ConfirmationService,
    LabelResolver,
    provideErrorTailorConfig({
      controlErrorsOn: { async: true, blur: true, change: true },
      errors: {
        useFactory: (i18n: TranslateService) => {
          return {
            required: () => i18n.instant('VALIDATION.ERRORS.EMPTY_REQUIRED_FIELD'),
            maxlength: ({ requiredLength }) =>
              i18n.instant('VALIDATION.ERRORS.MAXIMUM_LENGTH').replace('{{chars}}', requiredLength),
            minlength: ({ requiredLength }) =>
              i18n.instant('VALIDATION.ERRORS.MINIMUM_LENGTH').replace('{{chars}}', requiredLength),
            pattern: () => i18n.instant('VALIDATION.ERRORS.PATTERN_ERROR')
          }
        },
        deps: [TranslateService]
      },
      // this is required because PrimeNG calendar/datepicker wraps controls in a custom element
      blurPredicate: (element: Element) => {
        return ['INPUT', 'TEXTAREA', 'SELECT', 'CUSTOM-DATE', 'P-CALENDAR', 'P-DATEPICKER', 'P-SELECT'].includes(
          element.tagName
        )
      }
    })
  ]
})
export class SharedModule {}
