import { Component } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { AngularFireDatabase } from '@angular/fire/database';
import { AngularFireAuth } from '@angular/fire/auth';

@Component({
  selector: 'app-plant-monitor',
  templateUrl: './plant-monitor.component.html',
  styleUrls: ['./plant-monitor.component.css']
})
export class PlantMonitorComponent {

  plants: Observable<any[]>;

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  constructor(private breakpointObserver: BreakpointObserver, public db: AngularFireDatabase, public auth: AngularFireAuth) {
    console.log('ID TOKEN:', auth.idToken);
    this.plants = db.list(`${auth.idToken}/plants`).valueChanges();
  }

}
