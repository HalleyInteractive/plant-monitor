import { Injectable } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class WebespConfigService {

  customFirebaseHosting: boolean = false;
  espConfigForm = new FormGroup ({ 
    wifiSSID: new FormControl(),
    wifiPassword: new FormControl(),
    fbUsername: new FormControl(),
    fbPassword: new FormControl(),
    fbHost: new FormControl('happy-plant-17512-default-rtdb.firebaseio.com'),
    fbAPIKey: new FormControl('AIzaSyD_JE_Iyh00ElVSGJHCm0-9B3l4H9fLnZc')
  });

  constructor() { }

  getConfig() {
    return this.espConfigForm.value;
  }
}
