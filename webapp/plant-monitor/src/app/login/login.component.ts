import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.sass']
})
export class LoginComponent implements OnInit {

  hide = true;
  loginForm = new FormGroup ({ 
    username: new FormControl(),
    password: new FormControl()
  });

  constructor(public auth: AngularFireAuth, private _snackBar: MatSnackBar, private router: Router) { }

  ngOnInit(): void {}

  login():void {
    const credentials = this.loginForm.value;
    this.auth.signInWithEmailAndPassword(credentials.username, 
      credentials.password)
    .then(() => {
      this.router.navigate(['']);
    })
    .catch((reason) => {
      this._snackBar.open(reason?.message);
    });
  }
  
  createAccount():void {
    const credentials = this.loginForm.value;
    console.log('Create account');
    this.auth.createUserWithEmailAndPassword(credentials.username, credentials.password)
    .then((user) => {
      this.router.navigate(['']);
    })
    .catch((reason) => {
      this._snackBar.open(reason?.message);
    })
  }

}
