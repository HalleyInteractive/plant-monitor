EESchema Schematic File Version 4
EELAYER 30 0
EELAYER END
$Descr A4 11693 8268
encoding utf-8
Sheet 1 1
Title ""
Date ""
Rev ""
Comp ""
Comment1 ""
Comment2 ""
Comment3 ""
Comment4 ""
$EndDescr
$Comp
L MCU_Espressif:ESP8266EX U?
U 1 1 5F61120C
P 3050 3500
F 0 "U?" H 3050 2311 50  0000 C CNN
F 1 "ESP8266EX" H 3050 2220 50  0000 C CNN
F 2 "Package_DFN_QFN:QFN-32-1EP_5x5mm_P0.5mm_EP3.45x3.45mm" H 3050 2200 50  0001 C CNN
F 3 "http://espressif.com/sites/default/files/documentation/0a-esp8266ex_datasheet_en.pdf" H 3150 2200 50  0001 C CNN
	1    3050 3500
	1    0    0    -1  
$EndComp
$Comp
L Sensor_Optical:LDR03 R?
U 1 1 5F613E84
P 4850 2800
F 0 "R?" H 4920 2846 50  0000 L CNN
F 1 "LDR03" H 4920 2755 50  0000 L CNN
F 2 "OptoDevice:R_LDR_10x8.5mm_P7.6mm_Vertical" V 5025 2800 50  0001 C CNN
F 3 "http://www.elektronica-componenten.nl/WebRoot/StoreNL/Shops/61422969/54F1/BA0C/C664/31B9/2173/C0A8/2AB9/2AEF/LDR03IMP.pdf" H 4850 2750 50  0001 C CNN
	1    4850 2800
	1    0    0    -1  
$EndComp
$Comp
L Device:R R?
U 1 1 5F614D07
P 5750 2150
F 0 "R?" H 5820 2196 50  0000 L CNN
F 1 "R" H 5820 2105 50  0000 L CNN
F 2 "" V 5680 2150 50  0001 C CNN
F 3 "~" H 5750 2150 50  0001 C CNN
	1    5750 2150
	1    0    0    -1  
$EndComp
$Comp
L Device:R R?
U 1 1 5F6155A0
P 6250 2150
F 0 "R?" H 6320 2196 50  0000 L CNN
F 1 "R" H 6320 2105 50  0000 L CNN
F 2 "" V 6180 2150 50  0001 C CNN
F 3 "~" H 6250 2150 50  0001 C CNN
	1    6250 2150
	1    0    0    -1  
$EndComp
$Comp
L Device:R R?
U 1 1 5F615A79
P 6850 2150
F 0 "R?" H 6920 2196 50  0000 L CNN
F 1 "R" H 6920 2105 50  0000 L CNN
F 2 "" V 6780 2150 50  0001 C CNN
F 3 "~" H 6850 2150 50  0001 C CNN
	1    6850 2150
	1    0    0    -1  
$EndComp
$Comp
L Device:LED D?
U 1 1 5F616EAD
P 5050 4050
F 0 "D?" H 5043 4266 50  0000 C CNN
F 1 "LED" H 5043 4175 50  0000 C CNN
F 2 "" H 5050 4050 50  0001 C CNN
F 3 "~" H 5050 4050 50  0001 C CNN
	1    5050 4050
	1    0    0    -1  
$EndComp
$Comp
L Device:LED D?
U 1 1 5F617A91
P 5050 4400
F 0 "D?" H 5043 4616 50  0000 C CNN
F 1 "LED" H 5043 4525 50  0000 C CNN
F 2 "" H 5050 4400 50  0001 C CNN
F 3 "~" H 5050 4400 50  0001 C CNN
	1    5050 4400
	1    0    0    -1  
$EndComp
$Comp
L Connector:Conn_01x03_Male J?
U 1 1 5F6182A2
P 4250 1450
F 0 "J?" H 4358 1731 50  0000 C CNN
F 1 "Conn_01x03_Male" H 4358 1640 50  0000 C CNN
F 2 "" H 4250 1450 50  0001 C CNN
F 3 "~" H 4250 1450 50  0001 C CNN
	1    4250 1450
	1    0    0    -1  
$EndComp
$EndSCHEMATC
