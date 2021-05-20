import { Component } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent {
  title = 'plant-monitor';
  constructor(public auth: AngularFireAuth, private router: Router) {
  }

  logout() {
    this.auth.signOut().then(() => {
      this.router.navigate(['login']);
    });
  }

  openGithub() {
    window.open("https://github.com/HalleyInteractive/plant-monitor", "_blank");
  }
}
