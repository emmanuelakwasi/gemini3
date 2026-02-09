import type { BoardType } from "@/lib/types";

export type PowerChecklistItem = { id: string; label: string; checked: boolean };

export const POWER_CHECKLIST_DEFAULTS: Omit<PowerChecklistItem, "checked">[] = [
  { id: "gnd", label: "Shared GND" },
  { id: "voltage", label: "Correct voltage" },
  { id: "shorts", label: "No shorts" },
  { id: "reference", label: "Common reference" },
];

function esp32Scanner(sda: number, scl: number): string {
  return `// I2C Scanner - ESP32 (SDA=${sda}, SCL=${scl})
#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin(${sda}, ${scl});
  Serial.println("I2C Scanner");
}

void loop() {
  byte count = 0;
  Serial.println("Scanning...");
  for (byte i = 8; i < 120; i++) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0) {
      Serial.print("Device at 0x");
      Serial.println(i, HEX);
      count++;
    }
  }
  Serial.println(count ? "Done." : "No devices found.");
  delay(5000);
}
`;
}

function arduinoScanner(): string {
  return `// I2C Scanner - Arduino (A4=SDA, A5=SCL on Uno/Nano)
#include <Wire.h>

void setup() {
  Serial.begin(9600);
  Wire.begin();
  Serial.println("I2C Scanner");
}

void loop() {
  byte count = 0;
  Serial.println("Scanning...");
  for (byte i = 8; i < 120; i++) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0) {
      Serial.print("Device at 0x");
      Serial.println(i, HEX);
      count++;
    }
  }
  Serial.println(count ? "Done." : "No devices found.");
  delay(5000);
}
`;
}

function stm32Scanner(): string {
  return `// I2C Scanner - STM32 (Wire = I2C1, default SDA/SCL board-dependent)
#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Serial.println("I2C Scanner");
}

void loop() {
  byte count = 0;
  Serial.println("Scanning...");
  for (byte i = 8; i < 120; i++) {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0) {
      Serial.print("Device at 0x");
      Serial.println(i, HEX);
      count++;
    }
  }
  Serial.println(count ? "Done." : "No devices found.");
  delay(5000);
}
`;
}

export function generateI2CScanner(
  boardType: BoardType,
  sda: number = 21,
  scl: number = 22
): string {
  switch (boardType) {
    case "ESP32":
      return esp32Scanner(sda, scl);
    case "Arduino":
      return arduinoScanner();
    case "STM32":
      return stm32Scanner();
    default:
      return esp32Scanner(sda, scl);
  }
}

export function powerChecklistToMarkdown(items: PowerChecklistItem[]): string {
  const lines = ["## Power checklist", ""];
  items.forEach((item) => {
    lines.push(`- [${item.checked ? "x" : " "}] ${item.label}`);
  });
  lines.push("");
  return lines.join("\n");
}
