from PyQt6.QtCore import QObject, pyqtSlot, Qt
from PyQt6.QtGui import QImage
from pathlib import Path
import win32print
import sys


class PrinterBackend(QObject):
    def __init__(self):
        super().__init__()

        if sys.platform != "win32":
            raise RuntimeError("PrinterBackend only supported on Windows")

        self.printer_name = win32print.GetDefaultPrinter()

        base_dir = Path(__file__).resolve().parent.parent
        self.logo_path = base_dir / "assets" / "logo.ico"

        if not self.logo_path.exists():
            self.logo_path = base_dir / "assets" / "logo.png"

        if not self.logo_path.exists():
            self.logo_path = base_dir / "assets" / "logo.jpg"

    def _image_to_escpos(self, image_path: Path, max_width=384):
        """Convert image to ESC/POS bitmap bytes"""

        try:
            if not image_path or not image_path.exists():
                return None

            img = QImage(str(image_path))
            if img.isNull():
                return None

            # Resize to printer width
            if img.width() > max_width:
                img = img.scaledToWidth(
                    max_width,
                    Qt.SmoothTransformation
                )

            # Convert to grayscale
            img = img.convertToFormat(QImage.Format.Format_Grayscale8)

            width = img.width()
            height = img.height()
            bytes_per_line = (width + 7) // 8

            escpos = bytearray()

            # Center alignment
            escpos.extend(b'\x1B\x61\x01')

            for y in range(height):
                escpos.extend(b'\x1B\x2A\x00')  # ESC * 0
                escpos.extend(bytes([
                    bytes_per_line & 0xFF,
                    (bytes_per_line >> 8) & 0xFF
                ]))

                line = bytearray()

                for x in range(0, width, 8):
                    byte = 0
                    for bit in range(8):
                        if x + bit < width:
                            pixel = img.pixelColor(x + bit, y).red()
                            if pixel < 128:  # threshold
                                byte |= (1 << (7 - bit))
                    line.append(byte)

                while len(line) < bytes_per_line:
                    line.append(0)

                escpos.extend(line)

            # Reset alignment + feed
            escpos.extend(b'\x1B\x61\x00\n\n')

            return escpos

        except Exception as e:
            print(f"ESC/POS image error: {e}")
            return None

    @pyqtSlot(str, result=str)
    def print_receipt(self, text):
        try:
            hPrinter = win32print.OpenPrinter(self.printer_name)

            try:
                win32print.StartDocPrinter(
                    hPrinter,
                    1,
                    ("CraveHub Receipt", None, "RAW")
                )
                win32print.StartPagePrinter(hPrinter)

                # Print logo
                logo_bytes = self._image_to_escpos(self.logo_path)
                if logo_bytes:
                    win32print.WritePrinter(hPrinter, bytes(logo_bytes))

                # Print text
                win32print.WritePrinter(hPrinter, text.encode("utf-8"))

                # Feed + cut (partial cut)
                win32print.WritePrinter(hPrinter, b"\n\n\x1D\x56\x41\x10")

                win32print.EndPagePrinter(hPrinter)
                win32print.EndDocPrinter(hPrinter)

            finally:
                win32print.ClosePrinter(hPrinter)

            return '{"success": true, "message": "Printed successfully"}'

        except Exception as e:
            return f'{{"success": false, "error": "{str(e)}"}}'
