import { Component, OnInit } from '@angular/core';
import { WebespConfigService } from '../webesp-config.service';

@Component({
  selector: 'app-webesp-config',
  templateUrl: './webesp-config.component.html',
  styleUrls: ['./webesp-config.component.sass']
})
export class WebespConfigComponent implements OnInit {

  constructor(public config:WebespConfigService) { }

  ngOnInit(): void {
  }

}
