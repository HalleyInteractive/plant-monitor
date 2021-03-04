# WebESP

A web-based programming tool for ESP32 devices. This uses webserial to provide
a user friendly interface for flashing prederefined images to an ESP32 device
with some customization patches applied.

This is still somewhat experimental and there are quite a few rough edges:

- Error handling is incomplete. Some situations will require a page reload to
  get out of.
- The terminal support for ANSI escape sequences is limited to what the ESP32
  samples use.
- Bit rate change doesn't work yet.
