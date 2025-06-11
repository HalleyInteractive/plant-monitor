import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ConnectionButton } from "./components/connection-button/connection-button";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatToolbarModule, ConnectionButton],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected title = 'Happy Plant';
}
