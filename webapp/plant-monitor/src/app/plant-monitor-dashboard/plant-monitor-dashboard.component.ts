import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { LineChartComponent } from './../line-chart/line-chart.component';
import { PlantService, PlantStatus } from '../plant.service';

@Component({
  selector: 'app-plant-monitor-dashboard',
  templateUrl: './plant-monitor-dashboard.component.html',
  styleUrls: ['./plant-monitor-dashboard.component.sass']
})
export class PlantMonitorDashboardComponent implements OnInit {

  plantService:PlantService;

  @ViewChild(LineChartComponent) lineChart:LineChartComponent;

  constructor(plantService:PlantService) {
    this.plantService = plantService;
  }

  ngOnInit(): void {
  }

}
