import { Component, inject } from '@angular/core';
import { EspService } from '../../services/esp-service';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-logs',
  imports: [MatListModule, MatCardModule],
  templateUrl: './logs.html',
  styleUrl: './logs.scss'
})
export class Logs {
  readonly espService = inject(EspService);
}
