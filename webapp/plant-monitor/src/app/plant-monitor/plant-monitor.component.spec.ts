import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlantMonitorComponent } from './plant-monitor.component';

describe('PlantMonitorComponent', () => {
  let component: PlantMonitorComponent;
  let fixture: ComponentFixture<PlantMonitorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlantMonitorComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlantMonitorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
