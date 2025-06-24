import { Component, computed, inject } from '@angular/core';
import { EspService } from '../../services/esp-service';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Logs } from '../../components/logs/logs';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartOptions, ChartData, registerables } from 'chart.js';

@Component({
  selector: 'app-home',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatToolbarModule,
    MatIconModule,
    MatDividerModule,
    MatListModule,
    Logs,
    BaseChartDirective,
  ],
  standalone: true,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  readonly espService = inject(EspService);

  constructor() {
    // Register all Chart.js components to enable tree-shaking
    Chart.register(...registerables);
  }

  // Doughnut Chart Options
  public doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    cutout: '70%',
    plugins: {
        legend: {
            display: false
        }
    }
  };

  // Water Doughnut Chart Data
  public waterChartData = computed<ChartData<'doughnut'>>(() => {
    const waterValue = this.espService.currentWaterValue() ?? 0;
    return {
      labels: ['Water', ''],
      datasets: [
        {
          data: [waterValue, 100 - waterValue],
          backgroundColor: ['#3498db', '#343a40'],
          hoverBackgroundColor: ['#2980b9', '#343a40'],
          borderColor: '#1e1e1e',
          borderWidth: 2
        },
      ],
    };
  });

  // Light Doughnut Chart Data
  public lightChartData = computed<ChartData<'doughnut'>>(() => {
    const lightValue = this.espService.currentLightValue() ?? 0;
    return {
      labels: ['Light', ''],
      datasets: [
        {
          data: [lightValue, 100 - lightValue],
          backgroundColor: ['#f1c40f', '#343a40'],
          hoverBackgroundColor: ['#f39c12', '#343a40'],
          borderColor: '#1e1e1e',
          borderWidth: 2
        },
      ],
    };
  });

  // Line Chart Options
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { color: '#adb5bd' }
      },
      x: {
        ticks: { color: '#adb5bd' }
      }
    },
    plugins: {
        legend: {
            labels: {
                color: '#adb5bd'
            }
        }
    }
  };

  // Line Chart Data
  public lineChartData = computed<ChartData<'line'>>(() => {
    const waterHistory = this.espService.waterHistory();
    const lightHistory = this.espService.lightHistory();
    const labelCount = Math.max(waterHistory.length, lightHistory.length);

    return {
      labels: Array.from({ length: labelCount }, (_, i) => `Reading ${i + 1}`),
      datasets: [
        {
          data: waterHistory,
          label: 'Water History',
          fill: false,
          tension: 0.1,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
          yAxisID: 'y'
        },
        {
          data: lightHistory,
          label: 'Light History',
          fill: false,
          tension: 0.1,
          borderColor: '#f1c40f',
          backgroundColor: 'rgba(241, 196, 15, 0.2)',
          yAxisID: 'y'
        },
      ],
    };
  });
}