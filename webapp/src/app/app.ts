import { Component } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { ConnectionButton } from "./components/connection-button/connection-button";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatToolbarModule, ConnectionButton, RouterModule, MatButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected title = 'Happy Plant';
}
