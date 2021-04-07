import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebespTerminalComponent } from './webesp-terminal.component';

describe('WebespTerminalComponent', () => {
  let component: WebespTerminalComponent;
  let fixture: ComponentFixture<WebespTerminalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WebespTerminalComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WebespTerminalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
