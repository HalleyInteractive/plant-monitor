import { NgModule } from '@angular/core';
import { PlantMonitorComponent } from './plant-monitor/plant-monitor.component'
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '', component: PlantMonitorComponent
  },
  {
    path: 'programmer', component: PlantMonitorComponent,
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
