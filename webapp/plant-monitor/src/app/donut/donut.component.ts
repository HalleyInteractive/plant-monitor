import { Component, OnInit, Input } from '@angular/core';
import { ChartOptions} from 'chart.js';
import { MultiDataSet, Label, Color } from 'ng2-charts';

@Component({
  selector: 'app-donut',
  templateUrl: './donut.component.html',
  styleUrls: ['./donut.component.sass']
})
export class DonutComponent implements OnInit {

  @Input() public donutColor: string;
  public doughnutChartColors: Color[];
  public doughnutChartLabels: Label[] = [];
  public doughnutChartData: MultiDataSet = [[0, 0]];
  public chartOptions: ChartOptions = {
    // tooltips: {
    //   enabled: false
    // },
    responsive: true
  }

  constructor() {
    
  }

  @Input()
  set donutValue(value:number) {
    if(value !== null) {
      const remaining = 100 - value;
      this.doughnutChartData = [[value, remaining]];
    }
  }

  ngOnInit(): void {
    this.doughnutChartColors = [
      {backgroundColor:[this.donutColor, 'rgba(219, 219, 219, 1)']
    }];
  }

}
