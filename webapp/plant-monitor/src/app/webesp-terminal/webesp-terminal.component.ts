import { Component, OnInit } from '@angular/core';
import { WebespTerminalService } from '../webesp-terminal.service';

@Component({
  selector: 'app-webesp-terminal',
  templateUrl: './webesp-terminal.component.html',
  styleUrls: ['./webesp-terminal.component.sass']
})
export class WebespTerminalComponent implements OnInit {

  constructor(public terminal:WebespTerminalService) {
  }

  ngOnInit(): void {
  }

}
