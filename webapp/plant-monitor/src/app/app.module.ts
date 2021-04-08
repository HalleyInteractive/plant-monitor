import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { LoginComponent } from './login/login.component';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { AngularFireModule } from '@angular/fire';
import { environment } from '../environments/environment';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { PlantMonitorComponent } from './plant-monitor/plant-monitor.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { LayoutModule } from '@angular/cdk/layout';
import { MatListModule } from '@angular/material/list';
import { PlantMonitorDashboardComponent } from './plant-monitor-dashboard/plant-monitor-dashboard.component';
import { ChartsModule } from 'ng2-charts';
import { DonutComponent } from './donut/donut.component';
import { WebespComponent } from './webesp/webesp.component';
import { WebespTerminalComponent } from './webesp-terminal/webesp-terminal.component';
import { LineChartComponent } from './line-chart/line-chart.component';
import { WebespConfigComponent } from './webesp-config/webesp-config.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    PlantMonitorComponent,
    PlantMonitorDashboardComponent,
    DonutComponent,
    WebespComponent,
    WebespTerminalComponent,
    LineChartComponent,
    WebespConfigComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    MatGridListModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatSidenavModule,
    AngularFireModule.initializeApp(environment.firebase),
    LayoutModule,
    MatListModule,
    ChartsModule,
    ReactiveFormsModule,
    MatSlideToggleModule,
    MatExpansionModule,
    MatProgressBarModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
