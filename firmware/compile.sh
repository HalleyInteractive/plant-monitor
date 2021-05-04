# MAIN APP
arduino-cli compile -b esp32:esp32:esp32 --export-binaries ./plant-monitor/plant-monitor.ino
cp ./plant-monitor/build/esp32.esp32.esp32/plant-monitor.ino.bin ./bin/app.bin

# BOOTLOADER
cp ./bootloader-image/bootloader_dio_40m.bin ./bin/bootloader.bin

# PARTITION TABLE
python ./partition-table/gen_esp32part.py ./partition-table/partition-table.csv ./bin/partition-table.bin

# NVS PARTITION
python ./nvs-partition/nvs_partition_gen.py generate ./nvs-partition/nvs-file.csv ./bin/nvs-partition.bin 0x6000

# COPY TO WEBAPP
cp -r ./bin ./../webapp/plant-monitor/src/assets/