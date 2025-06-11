import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectionButton } from './connection-button';

describe('ConnectionButton', () => {
  let component: ConnectionButton;
  let fixture: ComponentFixture<ConnectionButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectionButton]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConnectionButton);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
