import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebespConfigComponent } from './webesp-config.component';

describe('WebespConfigComponent', () => {
  let component: WebespConfigComponent;
  let fixture: ComponentFixture<WebespConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WebespConfigComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WebespConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
