import { Component, OnInit } from '@angular/core';
import { PlantService } from '../plant.service';

@Component({
  selector: 'app-plant-monitor-dashboard',
  templateUrl: './plant-monitor-dashboard.component.html',
  styleUrls: ['./plant-monitor-dashboard.component.sass']
})
export class PlantMonitorDashboardComponent implements OnInit {

  constructor(public plantService:PlantService) {
  }

  ngOnInit(): void {
  }

}
