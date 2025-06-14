import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Logs } from './logs';

describe('Logs', () => {
  let component: Logs;
  let fixture: ComponentFixture<Logs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Logs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Logs);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
