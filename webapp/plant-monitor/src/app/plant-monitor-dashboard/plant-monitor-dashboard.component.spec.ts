import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlantMonitorDashboardComponent } from './plant-monitor-dashboard.component';

describe('PlantMonitorDashboardComponent', () => {
  let component: PlantMonitorDashboardComponent;
  let fixture: ComponentFixture<PlantMonitorDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlantMonitorDashboardComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlantMonitorDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
