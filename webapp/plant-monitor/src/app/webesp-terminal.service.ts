import { Injectable } from '@angular/core';

enum LogOrigin {
  WEB_ESP = 0,
  ESP = 1
}
interface LogEntry {
  timestamp: number;
  origin: LogOrigin; 
  value: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebespTerminalService {

  private maxLogs:number = 200;
  private sequences : {[key:string]:string}= {
    '[0;32m': '<span style="color:#0c0;">',
    '[0;33m': '<span style="color:#cc0;">',
    '[0m': '</span>',
  }
  logs:LogEntry[] = [];

  constructor() { }

  write(a: string) {
    let s = "";
    for (let i = 0; i < a.length; ++i) {
      // This is kind of crappy, since it assumes that everything is kind of well formed.
      if (a.charCodeAt(i) == 27) {
        for (const k in this.sequences) {
          if (a.substr(i+1, k.length) == k) {
            s += this.sequences[k]; 
            i += k.length;
          }
        }
      } else {
        s += a[i];
      }
    }
    this.logs.unshift({value: s, origin: LogOrigin.ESP, timestamp: new Date().getTime()});
    this.truncateTerminal();
  }

  print(s: string) {
    this.logs.unshift({value: s, origin: LogOrigin.WEB_ESP, timestamp: new Date().getTime()});
    this.truncateTerminal();
  }

  private truncateTerminal() {
    if(this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
  }

}
