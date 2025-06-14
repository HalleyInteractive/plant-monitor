import { Component, inject, signal } from '@angular/core';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatButtonModule} from '@angular/material/button';
import { EspService } from '../../services/esp-service';
import { Partition } from 'esp-controller';

@Component({
  selector: 'app-flash',
  imports: [MatProgressBarModule, MatButtonModule],
  templateUrl: './flash.html',
  styleUrl: './flash.scss'
})
export class Flash {

  readonly espService = inject(EspService);
  readonly syncProgress = signal(0);
  readonly flashPartition = signal<Partition | null>(null);
  readonly flashPartitionProgress = signal(0)
  readonly flashImagePartition = signal<Partition | null>(null);
  readonly flashImagePartitionProgress = signal(0)

  constructor() {
    this.espService.controller.addEventListener("sync-progress", (e) => {
      const event = e as CustomEvent<{ progress: number }>;
      this.syncProgress.set(event.detail.progress);
    });

    this.espService.controller.addEventListener("flash-image-progress", (e) => {
      const event = e as CustomEvent<{ progress: number; partition: Partition }>;
      const partition = event.detail.partition;
      this.flashImagePartition.set(partition);
      this.flashImagePartitionProgress.set(event.detail.progress);
    });

    this.espService.controller.addEventListener("flash-progress", (e) => {
      const event = e as CustomEvent<{ progress: number; partition: Partition }>;
      const partition = event.detail.partition;
      this.flashPartition.set(partition);
      this.flashPartitionProgress.set(event.detail.progress);
    });
  }
  
}
