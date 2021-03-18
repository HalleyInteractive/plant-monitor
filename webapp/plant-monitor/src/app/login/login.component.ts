import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { MatSnackBar } from '@angular/material/snack-bar';
import firebase from 'firebase/app';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.sass']
})
export class LoginComponent implements OnInit {

  hide = true;
  username = '';
  password = '';

  constructor(public auth: AngularFireAuth, private _snackBar: MatSnackBar, private router: Router) { }

  ngOnInit(): void {}

  updateUsername(value):void {
    this.username = value;
  }

  updatePassword(value):void {
    this.password = value;
  }

  login():void {
    this.auth.signInWithEmailAndPassword(this.username, this.password)
    .then(() => {
      this.router.navigate(['']);
    })
    .catch((reason) => {
      this._snackBar.open(reason?.message);
    })
  }

}
