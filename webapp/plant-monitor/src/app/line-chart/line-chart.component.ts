import { Component, OnInit } from '@angular/core';
import { PlantService } from '../plant.service';

interface Dataset {
  data: number[];
  label: string;
}

@Component({
  selector: 'app-line-chart',
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.sass']
})
export class LineChartComponent implements OnInit {

  constructor(public plantService:PlantService) {
  }

  ngOnInit(): void {
  }

}
