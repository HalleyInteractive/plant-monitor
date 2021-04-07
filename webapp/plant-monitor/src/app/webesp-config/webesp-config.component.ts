import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-webesp-config',
  templateUrl: './webesp-config.component.html',
  styleUrls: ['./webesp-config.component.sass']
})
export class WebespConfigComponent implements OnInit {

  hide = true;
  espConfig = new FormGroup ({ 
    wifiSSID: new FormControl(),
    wifiPassword: new FormControl()
  });

  constructor() { }

  ngOnInit(): void {
  }

  save(): void {
    
  }

}
