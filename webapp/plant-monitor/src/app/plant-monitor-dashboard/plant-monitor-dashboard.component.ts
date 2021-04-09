import { Component, OnInit } from '@angular/core';
import { PlantService } from '../plant.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-plant-monitor-dashboard',
  templateUrl: './plant-monitor-dashboard.component.html',
  styleUrls: ['./plant-monitor-dashboard.component.sass']
})
export class PlantMonitorDashboardComponent implements OnInit {

  constructor(public plantService:PlantService, public dialog: MatDialog) {
  }

  ngOnInit(): void {
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(DialogPlantConfigDialog);

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
    });
  }

}

@Component({
  selector: 'dialog-plant-config-dialog',
  templateUrl: 'dialog-plant-config.html',
})
export class DialogPlantConfigDialog {

  plantConfigForm = new FormGroup ({ 
    name: new FormControl(),
    tts: new FormControl()
  });
  constructor(public dialogRef: MatDialogRef<DialogPlantConfigDialog>, public plantService:PlantService) {
    this.plantConfigForm = new FormGroup ({ 
      name: new FormControl(this.plantService?.plantConfig?.name),
      tts: new FormControl(this.plantService?.plantConfig?.tts)
    });
  }

  onCancelClick(): void {
    this.dialogRef.close();
  }

  onSaveClick(): void {
    const config = this.plantConfigForm.value;
    console.log(config);
    this.plantService.savePlantConfig(config);
    this.dialogRef.close();
  }

}