from PyQt6.QtCore import QObject, pyqtSlot
from PyQt6.QtGui import QImage
from pathlib import Path
import win32print
import sys


class PrinterBackend(QObject):
    def __init__(self):
        super().__init__()

        if sys.platform != "win32":
            raise RuntimeError("Windows only")

        self.printer_name = win32print.GetDefaultPrinter()
        base_dir = Path(__file__).resolve().parent.parent
        self.logo_path = base_dir / "assets" / "logo.png"

    def _print_logo(self, hPrinter):
        if not self.logo_path.exists():
            return

        img = QImage(str(self.logo_path))
        if img.isNull():
            return

        img = img.convertToFormat(QImage.Format.Format_Mono)
        img = img.scaledToWidth(384)

        width_bytes = img.width() // 8
        height = img.height()

        data = bytearray()
        data += b'\x1B\x61\x01'  # center

        for y in range(height):
            data += b'\x1B\x2A\x00'
            data += bytes([width_bytes, 0])

            for x in range(0, img.width(), 8):
                byte = 0
                for bit in range(8):
                    if img.pixel(x + bit, y) == 0:
                        byte |= (1 << (7 - bit))
                data.append(byte)

        data += b'\n\n'
        win32print.WritePrinter(hPrinter, data)

    @pyqtSlot(str, result=str)
    def print_receipt(self, text):
        try:
            hPrinter = win32print.OpenPrinter(self.printer_name)

            win32print.StartDocPrinter(hPrinter, 1, ("Receipt", None, "RAW"))
            win32print.StartPagePrinter(hPrinter)

            # LOGO FIRST
            self._print_logo(hPrinter)

            # TEXT (CP437 — NOT UTF-8)
            win32print.WritePrinter(
                hPrinter,
                text.encode("cp437", errors="replace")
            )

            # FEED + CUT
            win32print.WritePrinter(hPrinter, b"\n\n\x1D\x56\x41\x10")

            win32print.EndPagePrinter(hPrinter)
            win32print.EndDocPrinter(hPrinter)
            win32print.ClosePrinter(hPrinter)

            return '{"success": true}'

        except Exception as e:
            return f'{{"success": false, "error": "{e}"}}'
