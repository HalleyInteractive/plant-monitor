import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebespComponent } from './webesp.component';

describe('WebespComponent', () => {
  let component: WebespComponent;
  let fixture: ComponentFixture<WebespComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WebespComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WebespComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
