import { Component, OnInit, Input } from '@angular/core';

interface PlantStatus {
  water: number;
  light: number;
  timestamp: number;
}

interface Dataset {
  data: number[];
  label: string;
}

interface DonutConfig {
  min: number;
  max: number;
}

@Component({
  selector: 'app-line-chart',
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.sass']
})
export class LineChartComponent implements OnInit {

  public lightData:number[] = [];
  public waterData:number[] = [];
  public lightConfig:DonutConfig = {
    min: 0,
    max: 4095
  }
  public waterConfig:DonutConfig = {
    min: 0,
    max: 4095
  }
  public chartLabels: string[] = [];
  public chartData:Dataset[] = [];
  private timestamps: Map<number, boolean> = new Map();

  constructor() {
    this.chartData[0] = {
      data: this.waterData,
      label: 'Water'
    }
    this.chartData[1] = {
      data: this.lightData,
      label: 'Light'
    };
  }

  @Input()
  set lineChartData(logs:{[key: string]:PlantStatus}) {
    if(logs) {
      for(const entry of Object.values(logs)) {
        // console.group(entry.timestamp);
        // console.log('Light', this.getLightValue(entry));
        // console.log('Water', this.getWaterValue(entry));
        // console.groupEnd();
        this.timestamps.set(entry.timestamp, true);
        this.lightData.push(this.getLightValue(entry));
        this.waterData.push(this.getWaterValue(entry));
        this.chartLabels.push(this.getDateTimeValue(entry));
      }
    }
  }

  map(num:number, inMin:number, inMax:number, outMin:number, outMax:number): number {
    return Math.round((num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin);
  }

  addEntry(entry:PlantStatus): void {
    this.lightData.push(this.getLightValue(entry));
    this.waterData.push(this.getWaterValue(entry));
    this.chartLabels.push(this.getDateTimeValue(entry));
  }

  private getDateTimeValue(entry:PlantStatus):string {
    return new Date(entry?.timestamp * 1000).toLocaleString();
  }

  private getWaterValue(entry:PlantStatus):number {
    return this.map(entry?.water, this.waterConfig.min,
      this.waterConfig.max, 100, 0);
  }

  private getLightValue(entry:PlantStatus):number {
    return this.map(entry?.light, this.lightConfig.min, 
      this.lightConfig.max, 0, 100);
  }

  clear(): void {
    console.log('Clear line chart');
    this.waterData = [];
    this.lightData = [];
    this.chartLabels = [];
    this.timestamps = new Map();
  }

  ngOnInit(): void {
  }

}
