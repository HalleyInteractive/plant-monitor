import { Injectable } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

interface PlaceHolderMapping {
  length: number;
  value: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebespConfigService {

  customFirebaseHosting: boolean = false;
  espConfigForm = new FormGroup ({ 
    wifiSSID: new FormControl(),
    wifiPassword: new FormControl(),
    firebaseUsername: new FormControl(),
    firebasePassword: new FormControl(),
    firebaseHost: new FormControl('happy-plant-17512-default-rtdb.firebaseio.com'),
    firebaseAPIKey: new FormControl('AIzaSyD_JE_Iyh00ElVSGJHCm0-9B3l4H9fLnZc')
  });

  constructor() { }

  getConfig() {
    return this.espConfigForm.value;
  }

  getPlaceholderMapping():Map<string, PlaceHolderMapping> {
    const config = this.espConfigForm.value;
    return new Map([
      ['PLACEHOLDER_FOR_WIFI_SSID', {length: 30, value:config.wifiSSID}],
      ['PLACEHOLDER_FOR_WIFI_PASSWORD', {length: 60, value:config.wifiPassword}],
      ['PLACEHOLDER_FOR_DATABASE_URL', {length: 120, value:config.firebaseHost}],
      ['PLACEHOLDER_FOR_API_KEY', {length: 60, value:config.firebaseAPIKey}],
      ['PLACEHOLDER_FOR_USERNAME', {length: 60, value:config.firebaseUsername}],
      ['PLACEHOLDER_FOR_FIREBASE_PASSWORD', {length: 60, value:config.firebasePassword}],
    ]);
  }
}
