import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Flash } from './flash';

describe('Flash', () => {
  let component: Flash;
  let fixture: ComponentFixture<Flash>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Flash]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Flash);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
