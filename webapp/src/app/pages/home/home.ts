import { Component, inject } from '@angular/core';
import { EspService } from '../../services/esp-service';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';


@Component({
  selector: 'app-home',
  imports: [MatButtonModule,MatCardModule, MatFormFieldModule, MatToolbarModule, MatIconModule, MatDividerModule, MatListModule],
  standalone: true,
  providers: [EspService],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  readonly espService = inject(EspService);
}
