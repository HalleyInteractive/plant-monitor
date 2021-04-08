import { Component, OnInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { PlantService } from '../plant.service';


@Component({
  selector: 'app-plant-monitor',
  templateUrl: './plant-monitor.component.html',
  styleUrls: ['./plant-monitor.component.sass']
})
export class PlantMonitorComponent implements OnInit {

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  constructor(private breakpointObserver: BreakpointObserver, public plantService:PlantService) {
  }

  ngOnInit(): void {

  }

  activatePlant(plantID:string) {
    this.plantService.activePlant = plantID;
  }

}
