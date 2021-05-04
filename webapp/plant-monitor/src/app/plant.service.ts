import { Injectable, Input, EventEmitter } from '@angular/core';
import { AngularFireDatabase, AngularFireObject, AngularFireList, snapshotChanges } from '@angular/fire/database';
import { AngularFireAuth } from '@angular/fire/auth';
import { DataSnapshot } from '@angular/fire/database/interfaces';

export interface Plants {
  [key: string]:Plant;
}

export interface Plant {
  last_update: PlantStatus;
  logs: {[key: string]: PlantStatus};
  config: PlantConfig;
}

export interface PlantStatus {
  water: number;
  light: number;
  timestamp: number;
}

interface SensorConfig {
  min: number;
  max: number;
}

interface SensorData {
  data: number[];
  label: string;
  borderColor?: string
  backgroundColor?: string;
  pointBackgroundColor?: string;
  pointBorderColor?: string;
  pointHoverBackgroundColor?: string;
  pointHoverBorderColor?: string;
}

interface PlantConfig {
  name?: string;
  tts?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PlantService {

  userID: string = '';
  plants: Plants;
  lastUpdate: PlantStatus;
  logs:PlantStatus[] = [];
  sensorDataset:SensorData[];
  timestampLogs:string[] = [];
  plantConfig:PlantConfig = {};

  public lightConfig:SensorConfig = {
    min: 0,
    max: 4095
  }
  public waterConfig:SensorConfig = {
    min: 0,
    max: 4095
  }

  private activePlantID: string;
  private db:AngularFireDatabase;
  private plantConfigRef:AngularFireObject<PlantConfig>;
  private lastUpdateSubscription:AngularFireObject<PlantStatus>;
  private logsSubscription:AngularFireList<{[key: string]: PlantStatus}>;

  constructor(auth: AngularFireAuth, db: AngularFireDatabase) {
    this.sensorDataset = [{
      data:[],
      label: 'water'
    },{
      data: [],
      borderColor: "#e755ba",
      label: 'light'
    }];
    this.db = db;
    auth.currentUser.then(user => {
      this.userID = user.uid;
      console.log(user);
      db.list(`${this.userID}/plants`).query.once("value").then(data => {
        this.plants = data.val();
        console.log(this.plants);
        this.activePlant = Object.keys(this.plants)[0];
      });
   });
  }

  @Input() 
  set activePlant(plantID:string) {
    if(plantID && plantID !== this.activePlantID) {
      this.activePlantID = plantID;
      this.setDatabaseSubscriptions();
    }
  }

  get activePlant():string {
    return this.activePlantID;
  }

  private map(num:number, inMin:number, inMax:number, outMin:number, outMax:number): number {
    return Math.round((num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin);
  }

  private getDateTimeValue(entry:PlantStatus):string {
    return new Date(entry?.timestamp * 1000).toLocaleString();
  }

  private getWaterValue(entry:PlantStatus):number {
    return this.map(entry?.water, this.waterConfig.min,
      this.waterConfig.max, 100, 0);
  }

  private getLightValue(entry:PlantStatus):number {
    return this.map(entry?.light, this.lightConfig.min, 
      this.lightConfig.max, 0, 100);
  }

  private clearLogs():void {
    this.logs = [];
    this.sensorDataset = [{
      data:[],
      label: 'water',
      borderColor: "rgba(62, 192, 247, 1)",
      backgroundColor: "rgba(62, 192, 247, 0.2)",
      pointBackgroundColor: "rgba(62, 192, 247, 1)",
      pointBorderColor: "rgba(62, 192, 247, 1)",
      pointHoverBackgroundColor: "rgba(62, 192, 247, 1)",
      pointHoverBorderColor: "rgba(62, 192, 247, 1)",
    },
    {
      data: [],
      label: 'light',
      borderColor: "rgba(252, 239, 93, 1)",
      backgroundColor: "rgba(252, 239, 93, 0.2)",
      pointBackgroundColor: "rgba(252, 239, 93, 1)",
      pointBorderColor: "rgba(252, 239, 93, 1)",
      pointHoverBackgroundColor: "rgba(252, 239, 93, 1)",
      pointHoverBorderColor: "rgba(252, 239, 93, 1)",
    }];
    this.timestampLogs = [];
  }

  private updateLogs(logSnapshot:DataSnapshot) {
    const log:PlantStatus = logSnapshot.val();
    this.logs.push(log);
    this.sensorDataset[0].data.push(this.getWaterValue(log));
    this.sensorDataset[1].data.push(this.getLightValue(log));
    this.timestampLogs.push(this.getDateTimeValue(log));
  }

  public savePlantConfig(config:PlantConfig) {
    this.plantConfigRef.set(config);
    this.plants[this.activePlantID].config = config;
    this.plantConfig = config;
  }

  private setDatabaseSubscriptions() {
    this.clearLogs();

    this.lastUpdateSubscription = this.db.object<PlantStatus>(`${this.userID}/plants/${this.activePlantID}/last_update`);
    this.lastUpdateSubscription.valueChanges().subscribe((update:PlantStatus) => {
      this.lastUpdate = {
        water: this.getWaterValue(update),
        light: this.getLightValue(update),
        timestamp: update.timestamp
      };
    });

    this.plantConfigRef = this.db.object<PlantConfig>(`${this.userID}/plants/${this.activePlantID}/config`);
    this.plantConfigRef.query.once('value').then((data) => {
      this.plantConfig = data.val();
      console.log('plant-config', data.val());
    });

    this.logsSubscription = this.db.list<{[key: string]: PlantStatus}>(`${this.userID}/plants/${this.activePlantID}/logs`);
    this.logsSubscription.query.orderByChild('timestamp').limitToLast(50).off('child_added',this.updateLogs)
    this.logsSubscription.query.orderByChild('timestamp').limitToLast(50).on('child_added', this.updateLogs.bind(this));
  }
}
