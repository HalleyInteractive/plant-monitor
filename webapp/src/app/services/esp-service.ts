import { Injectable, signal } from '@angular/core';
import { SerialController } from 'esp-controller';

@Injectable({
  providedIn: 'root'
})
export class EspService {

  controller = new SerialController();
  connected = signal(this.controller.connection.connected);

  async connect() {
    try {
      await this.controller.requestPort()
      await this.controller.openPort();
      console.log("Connection successful. Current state:", this.controller.connection.connected);
    } catch (error: unknown) {
      console.error("Connection failed:", error);
    }
  }

  async disconnect() {
    // await this.controller.closePort();
  }

}
