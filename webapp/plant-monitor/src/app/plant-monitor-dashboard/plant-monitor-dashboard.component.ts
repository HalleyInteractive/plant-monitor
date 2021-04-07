import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AngularFireDatabase } from '@angular/fire/database';
import { AngularFireAuth } from '@angular/fire/auth';
import { LineChartComponent } from './../line-chart/line-chart.component';

interface PlantStatus {
  water: number;
  light: number;
  timestamp: number;
}

interface Plant {
  last_update:PlantStatus;
  logs:{[key: string]:PlantStatus};
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

  lastStatus$: Observable<PlantStatus>;
  // logs$: Observable<{[key: string]:PlantStatus}>;
  public logs: {[key: string]:PlantStatus};
  @ViewChild(LineChartComponent) lineChart:LineChartComponent;

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
        if(this.lineChart) {
          this.lineChart.clear();
        }
        this.monitorPlant();
      }
    }
  }

  private monitorPlant() {
    this.lastStatus$ = this.db.object<PlantStatus>(`${this.userID}/plants/${this.plantID}/last_update`).valueChanges();
    const logRef = this.db.list(`${this.userID}/plants/${this.plantID}/logs`);
    logRef.query.orderByChild('timestamp').limitToLast(500).once("value").then(data => {
      this.logs = data.val();
    });
    logRef.snapshotChanges(['child_added'])
      .subscribe(actions => {
        actions.forEach(action => {
          console.log(action.type);
          console.log(action.key);
          console.log(action.payload.val());
        });
      });
  }

  ngOnInit(): void {
  }

}
