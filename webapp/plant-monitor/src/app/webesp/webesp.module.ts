import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebespComponent } from './webesp.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { WebespTerminalComponent } from './../webesp-terminal/webesp-terminal.component';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { WebespConfigService } from '../webesp-config.service';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { WebespConfigComponent } from '../webesp-config/webesp-config.component';
import { MatExpansionModule } from '@angular/material/expansion';

@NgModule({
  declarations: [
    WebespComponent,
    WebespConfigComponent,
    WebespTerminalComponent,
    WebespConfigService
  ],
  imports: [
    CommonModule,
    MatProgressBarModule,
    MatCardModule,
    MatGridListModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
    MatExpansionModule,
  ]
})
export class WebespModule { }
