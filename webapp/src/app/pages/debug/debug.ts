import { Component, inject } from '@angular/core';
import { EspService } from '../../services/esp-service';
import { CommonModule } from '@angular/common'; // For *ngIf, *ngFor, etc.
import { FormsModule } from '@angular/forms'; // For ngModel if needed later, or template-driven forms
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';


@Component({
  selector: 'app-debug',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatTooltipModule,
  ],
  standalone: true,
  templateUrl: './debug.html',
  styleUrl: './debug.scss'
})
export class Debug {
  // Inject EspService and make it public to use in the template
  public espService = inject(EspService);
}
