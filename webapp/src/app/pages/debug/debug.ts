import { Component, inject } from '@angular/core';
import { EspService } from '../../services/esp-service';
import { CommonModule } from '@angular/common'; // For *ngIf, *ngFor, etc.
import { FormsModule } from '@angular/forms'; // For ngModel if needed later, or template-driven forms

@Component({
  selector: 'app-debug',
  imports: [CommonModule, FormsModule], // Add CommonModule and FormsModule
  standalone: true, // Assuming this is a standalone component
  templateUrl: './debug.html',
  styleUrl: './debug.scss'
})
export class Debug {
  // Inject EspService and make it public to use in the template
  public espService = inject(EspService);
}
