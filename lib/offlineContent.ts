import type { BoardType } from "@/lib/types";

/** User-facing message when API fails — never expose stack traces */
export const OFFLINE_USER_MESSAGE =
  "Connection unavailable. Offline diagnostics are shown below.";

/** I2C/SPI pin validation template items (no AI required) */
export const I2C_SPI_VALIDATION_TEMPLATES: { title: string; items: string[] }[] = [
  {
    title: "I2C",
    items: [
      "SDA and SCL need pull-up resistors (typically 4.7 kΩ to 3.3 V or 5 V).",
      "Do not exceed 400 kHz (Fast mode) unless the bus and devices support it.",
      "Shared bus: all devices share same SDA/SCL; each has a unique 7-bit address.",
      "Check voltage level match: 3.3 V vs 5 V; use level shifter if mixed.",
    ],
  },
  {
    title: "SPI",
    items: [
      "MOSI, MISO, SCK, CS: correct pins per board pinout.",
      "CS (chip select) per device if multiple slaves; do not share CS unless designed for it.",
      "Clock polarity and phase (CPOL/CPHA) must match the device.",
      "Keep traces short or add series resistors if signal integrity is an issue.",
    ],
  },
];

/** Board-specific safe wiring rules (no AI required) */
export const BOARD_SAFE_WIRING_RULES: Record<BoardType, string[]> = {
  ESP32: [
    "3.3 V logic only; do not apply 5 V to GPIO.",
    "Max 12 mA per pin (sinking/sourcing); use external driver for higher current.",
    "Some pins are input-only or have pull-up only; check pinout for your variant.",
    "Avoid using strapping pins (e.g. GPIO 0, 2, 12, 15) for general I/O until after boot.",
  ],
  STM32: [
    "Check VDD and VDDA; do not exceed max VDD (e.g. 3.6 V for 3.3 V parts).",
    "GPIO current limits vary by pin (e.g. 25 mA max per pin on many parts).",
    "5 V tolerant pins are marked in the datasheet; others are 3.3 V only.",
    "Use appropriate NRST and BOOT0 if debugging or flashing.",
  ],
  Arduino: [
    "5 V boards (Uno, Mega): 5 V logic; 3.3 V pin is for 3.3 V devices only.",
    "3.3 V boards (e.g. Nano 33 IoT): 3.3 V logic; do not apply 5 V to I/O.",
    "Max 40 mA per pin (total 200 mA per port on AVR); use external driver for loads.",
    "I2C: A4 (SDA), A5 (SCL) on Uno/Nano; check your board pinout.",
  ],
};
