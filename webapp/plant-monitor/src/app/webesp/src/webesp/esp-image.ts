import { BinFilePartion } from './partition';
import { NVSPartition } from './../nvs/nvs-partition';
import { WebespTerminalService } from 'src/app/webesp-terminal.service';
import { WebespConfigService } from 'src/app/webesp-config.service';

export class ESPImage {
  partitions: Array<Partition> = [];

  constructor(private readonly terminal:WebespTerminalService, public webespConfig:WebespConfigService) { }

  async load() {
    this.partitions = [];
    const flashSettings = this.webespConfig.flashConfigForm.value;
    if(!this.webespConfig.customFlashingSettings || flashSettings.bootloader) {
      this.partitions.push(new BinFilePartion(0x1000, 'assets/bin/bootloader.bin', this.terminal));
    }
    if(!this.webespConfig.customFlashingSettings || flashSettings.partitionTable) {
      this.partitions.push(new BinFilePartion(0x8000, 'assets/bin/partition-table.bin', this.terminal));
    }
    if(!this.webespConfig.customFlashingSettings || flashSettings.nvsPartition) {
      this.partitions.push(new NVSPartition(0x9000, 'NVS Partition', 0x6000, this.webespConfig));
    }
    if(!this.webespConfig.customFlashingSettings || flashSettings.app) {
      this.partitions.push(new BinFilePartion(0x10000, 'assets/bin/app.bin', this.terminal));
    }
    for (let i = 0; i < this.partitions.length; ++i) {
      await this.partitions[i].load();
    }
  }

}

