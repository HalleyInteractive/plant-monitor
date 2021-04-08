import { Injectable } from '@angular/core';

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
  logs:string[] = [];

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
    this.logs.unshift(s);
    this.truncateTerminal();
  }

  print(s: string) {
    this.logs.unshift('<span style="background-color:#444;border:1px solid #ccc; border-radius:3px;">'+ s + '</span>');
    this.truncateTerminal();
  }

  private truncateTerminal() {
    if(this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
  }

}
