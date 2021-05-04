import { Component, OnInit } from '@angular/core';
import { WebespConfigService } from '../webesp-config.service';
import { WebespTerminalService } from '../webesp-terminal.service';
import { NavigationEnd, Router } from '@angular/router';
import { PortController } from './src/webesp/port-controller';
import { CommandWriter } from './src/webesp/command-writer';
import { ESPLoader } from './src/webesp/esp-loader';
import { ESPImage } from './src/webesp/esp-image';

@Component({
  selector: 'app-webesp',
  templateUrl: './webesp.component.html',
  styleUrls: ['./webesp.component.sass']
})
export class WebespComponent implements OnInit {

  public static DEFAULT_BAUD:BaudRate = 115200;
  public hideWifiPassword: boolean = true;
  public hideFirebasePassword: boolean = true;

  connect: HTMLButtonElement;
  reset: HTMLButtonElement;
  port: PortController | null = null;

  inFrame = false;
  frame = new CommandWriter();
  decoder = new TextDecoder();
  loader: ESPLoader | null = null;

  serialAvailable: Boolean = false;
  constructor(public terminal: WebespTerminalService, public config:WebespConfigService, private router: Router) {
    router.events.subscribe((event) => {
      if ( event instanceof NavigationEnd ) {
        this.onDisconnect();
      }
    });
  }

  ngOnInit(): void {
    if ('serial' in navigator) {
      this.serialAvailable = true;
    }
  }

  receive(data: Uint8Array) {
    //inputBuffer.push(...value);
    for (let i = 0; i < data.length; ++i) {
      // Parse the value.
      if (this.inFrame) {
        if (data[i] == 0xc0) {
          this.inFrame = false;
          if (this.loader == null) {
            console.log('Received unexpected frame', data);
          } else {
            this.loader!.receiveFrame(this.frame.unframed());
          }
        } else {
          this.frame.u8(data[i]);
        }
      } else if (data[i] == 0xc0) {
        // This may be the beginning of a framed packet.
        this.inFrame = true;
        this.frame.clear();
      } else if (data[i] == 13) {
        const str = this.decoder.decode(this.frame.get());
        this.terminal.write(str);
        this.frame.clear();
        if (str == 'waiting for download') {
          this.load();
        }
      } else if (data[i] != 10) {
        this.frame.u8(data[i]);
      }
    }
  }

  async onReset() {
    this.terminal.print('Reset');
    await this.port!.resetPulse();
  }

  async onDisconnect() {
    if (this.port !== null) {
      await this.port.disconnect();
      this.port = null;
    }
  }

  async onConnect() {
    try {
      const p = await navigator.serial.requestPort();
      this.port = new PortController(p, this, this.terminal);
      await this.port.connect(WebespComponent.DEFAULT_BAUD);
    } catch (err) {
      console.log('Port selection failed: ', err);
    }
  }

  async load() {
    console.log('Starting sync');
    const image = new ESPImage(this.terminal, this.config);
    await image.load();
    this.loader = new ESPLoader(this.port!, image, this.terminal);
    await this.loader.sync();
  }
}
