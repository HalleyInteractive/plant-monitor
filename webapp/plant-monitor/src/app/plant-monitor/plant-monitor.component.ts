import { Component, OnInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { AngularFireDatabase } from '@angular/fire/database';
import { AngularFireAuth } from '@angular/fire/auth';


@Component({
  selector: 'app-plant-monitor',
  templateUrl: './plant-monitor.component.html',
  styleUrls: ['./plant-monitor.component.sass']
})
export class PlantMonitorComponent implements OnInit {

  plants: Observable<any[]>;
  activePlant: string;
  user: string;

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  constructor(private breakpointObserver: BreakpointObserver, 
    public auth: AngularFireAuth, db: AngularFireDatabase) {
    this.auth.currentUser.then(user => {
      console.log(user);
      this.user = user.uid;
      console.log(`Getting path: ${this.user}/plants`)
      db.list(`${this.user}/plants`).query.once("value").then(data => {
        console.log(data.val());
        this.plants = data.val();
        console.log(Object.keys(this.plants)[0]);
        this.activePlant = Object.keys(this.plants)[0];
      });
   });
  }

  ngOnInit(): void {

  }

  activatePlant(plantID:string) {
    this.activePlant = plantID;
  }

}
