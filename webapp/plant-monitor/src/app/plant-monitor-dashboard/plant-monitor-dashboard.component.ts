import { Component, OnInit, Input } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AngularFireDatabase } from '@angular/fire/database';
import { AngularFireAuth } from '@angular/fire/auth';

interface PlantStatus {
  water: number;
  light: number;
  timestamp: number;
}

interface Plant {
  last_update:PlantStatus;
  logs:PlantStatus[];
}

@Component({
  selector: 'app-plant-monitor-dashboard',
  templateUrl: './plant-monitor-dashboard.component.html',
  styleUrls: ['./plant-monitor-dashboard.component.sass']
})
export class PlantMonitorDashboardComponent implements OnInit {

  ready: boolean;
  private plantID: string;
  private userID: string;
  private db:AngularFireDatabase;

  plant$: Observable<Plant>;

  constructor(public auth: AngularFireAuth, db: AngularFireDatabase) {
    this.db = db;
    this.ready = false;
    auth.currentUser.then(user => {
      this.userID = user.uid;
      if(this.plantID) {
        this.ready = true;
        this.monitorPlant();
      }
    });
  }

  @Input() 
  set activePlant(plantID:string) {
    if(plantID && plantID !== this.plantID) {
      this.plantID = plantID;
      if(this.userID) {
        this.ready = true;
        this.monitorPlant();
      }
    }
  }

  private monitorPlant() {
    this.plant$ = this.db.object<Plant>(`${this.userID}/plants/${this.plantID}`).valueChanges();
  }

  ngOnInit(): void {
  }

}
