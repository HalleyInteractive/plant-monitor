import { Component, OnInit, Input } from '@angular/core';
import { ChartType } from 'chart.js';
import { MultiDataSet, Label, Color } from 'ng2-charts';

@Component({
  selector: 'app-donut',
  templateUrl: './donut.component.html',
  styleUrls: ['./donut.component.sass']
})
export class DonutComponent implements OnInit {

  @Input() public donutColor: string;
  public donutColorRest:string;
  public doughnutChartColors: Color[];
  public doughnutChartLabels: Label[] = ['Download Sales'];
  public doughnutChartData: MultiDataSet = [
    [0, 0]
  ];
  public doughnutChartType: ChartType = 'doughnut';

  private test:Color;
  private test2:Color;
  constructor() { 
    this.doughnutChartColors = [this.test, this.test2];
    this.donutColor = "#FF0000";
    this.donutColorRest = "#00FF00";
  }

  @Input()
  set donutValue(value:number) {
    if(value !== null) {
      console.log('set donut value', value);
      this.doughnutChartData = [
        [Math.min(100, value), 100-Math.max(0, value)]
      ];
      console.log(this.doughnutChartData)
    }
  }
  ngOnInit(): void {
  }

}
