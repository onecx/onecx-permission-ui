import { AbstractControl, FormArray, FormGroup } from '@angular/forms'
import { SelectItem } from 'primeng/api'

export function limitText(text: string, limit: number): string {
  if (text) {
    return text.length < limit ? text : text.substring(0, limit) + '...'
  } else {
    return ''
  }
}

export function copyToClipboard(text?: string): void {
  if (text) navigator.clipboard.writeText(text)
}

/**
 *  FORM
 */
export function forceFormValidation(form: AbstractControl): void {
  if (form instanceof FormGroup || form instanceof FormArray) {
    for (const inner in form.controls) {
      const control = form.get(inner)
      control && forceFormValidation(control)
    }
  } else {
    form.markAsDirty()
    form.markAsTouched()
    form.updateValueAndValidity()
  }
}

/**
 *  DROPDOWN
 */
export type DropDownChangeEvent = MouseEvent & { value: any }

export function dropDownSortItemsByLabel(a: SelectItem, b: SelectItem): number {
  return (a.label ? a.label.toUpperCase() : '').localeCompare(b.label ? b.label.toUpperCase() : '')
}
export function dropDownGetLabelByValue(ddArray: SelectItem[], val: string): string | undefined {
  const a: any = ddArray.find((item: SelectItem) => {
    return item?.value == val
  })
  return a.label
}
export function sortByLocale(a: any, b: any): number {
  return a.toUpperCase().localeCompare(b.toUpperCase())
}

export function getCurrentDateTime(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`
}
