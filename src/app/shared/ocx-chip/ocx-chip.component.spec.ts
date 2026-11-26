import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing'
import { provideTranslateTestingService } from '@onecx/angular-testing'

import { OcxChipComponent } from './ocx-chip.component'

describe('OcxChipComponent', () => {
  let component: OcxChipComponent
  let fixture: ComponentFixture<OcxChipComponent>

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [OcxChipComponent],
      providers: [
        provideTranslateTestingService({
          de: require('src/assets/i18n/de.json'),
          en: require('src/assets/i18n/en.json')
        })
      ]
    }).compileComponents()
  }))

  beforeEach(() => {
    fixture = TestBed.createComponent(OcxChipComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })
})
