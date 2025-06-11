import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EspService } from '../../services/esp-service';

@Component({
  selector: 'app-connection-button',
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './connection-button.html',
  styleUrl: './connection-button.scss'
})
export class ConnectionButton {
  espService = inject(EspService);

  connect() {
    this.espService.connect();
  }
  disconnect() {
    this.espService.disconnect();
  }

}
