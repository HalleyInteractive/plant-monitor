import { Component } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import firebase from 'firebase/app';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent {
  title = 'plant-monitor';
  constructor(public auth: AngularFireAuth) {
  }
  login() {
    this.auth.signInWithRedirect(new firebase.auth.EmailAuthProvider());
  }
  logout() {
    this.auth.signOut();
  }
}
