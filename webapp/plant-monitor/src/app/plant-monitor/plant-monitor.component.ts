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

  plantService:PlantService;
  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  constructor(private breakpointObserver: BreakpointObserver, plantService:PlantService) {
    this.plantService = plantService;
  }

  ngOnInit(): void {

  }

  activatePlant(plantID:string) {
    this.plantService.activePlant = plantID;
  }

}
