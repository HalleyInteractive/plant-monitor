import { Component, inject } from '@angular/core';
import { EspService } from '../../services/esp-service';
import { MatListModule } from '@angular/material/list';
import { JsonPipe } from '@angular/common';
@Component({
  selector: 'app-logs',
  imports: [MatListModule, JsonPipe],
  templateUrl: './logs.html',
  styleUrl: './logs.scss'
})
export class Logs {
  readonly espService = inject(EspService);
}
