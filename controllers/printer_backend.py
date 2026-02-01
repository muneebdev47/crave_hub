from PyQt6.QtCore import QObject, pyqtSlot
import win32print
import sys
from pathlib import Path
from PIL import Image


class PrinterBackend(QObject):
    def __init__(self):
        super().__init__()

        if sys.platform != "win32":
            raise RuntimeError("Thermal printing supported on Windows only")

        self.printer_name = win32print.GetDefaultPrinter()
        self.RECEIPT_WIDTH = 384  # 80mm thermal printer (203 DPI)

    # --------------------------------------------------
    # Resolve logo path (works in dev + PyInstaller)
    # --------------------------------------------------
    def _get_logo_path(self):
        try:
            base_path = Path(sys._MEIPASS)  # PyInstaller
        except AttributeError:
            base_path = Path(__file__).resolve().parent.parent  # Dev

        for name in ("logo.png", "logo.ico", "logo.jpg", "logo.jpeg"):
            p = base_path / "assets" / name
            if p.exists():
                return p
        return None

    # --------------------------------------------------
    # Convert image → ESC/POS raster (GS v 0)
    # --------------------------------------------------
    def _image_to_escpos(self, image_path):
        try:
            # ---------- Load image ----------
            img = Image.open(image_path)

            # Remove transparency
            if img.mode == "RGBA":
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[3])
                img = bg

            # Convert to grayscale
            img = img.convert("L")

            # ---------- Resize (85–95% width looks best) ----------
            target_width = int(self.RECEIPT_WIDTH * 0.90)
            w, h = img.size
            ratio = target_width / w
            new_h = int(h * ratio)

            try:
                img = img.resize((target_width, new_h), Image.Resampling.LANCZOS)
            except AttributeError:
                img = img.resize((target_width, new_h), Image.LANCZOS)

            # ---------- Center logo on 384px canvas ----------
            left_pad = (self.RECEIPT_WIDTH - target_width) // 2
            canvas = Image.new("L", (self.RECEIPT_WIDTH, new_h), 255)
            canvas.paste(img, (left_pad, 0))
            img = canvas

            # ---------- Convert to pure B/W ----------
            img = img.point(lambda p: 0 if p < 128 else 255, mode="1")

            width, height = img.size
            bytes_per_row = (width + 7) // 8

            # ---------- ESC/POS: GS v 0 ----------
            xL = bytes_per_row & 0xFF
            xH = (bytes_per_row >> 8) & 0xFF
            yL = height & 0xFF
            yH = (height >> 8) & 0xFF

            escpos = bytearray()
            escpos.extend(b"\x1D\x76\x30\x00")  # GS v 0 m=0
            escpos.extend(bytes([xL, xH, yL, yH]))

            pixels = img.load()
            for y in range(height):
                for x in range(0, width, 8):
                    byte = 0
                    for b in range(8):
                        if x + b < width and pixels[x + b, y] == 0:
                            byte |= (1 << (7 - b))
                    escpos.append(byte)

            return bytes(escpos)

        except Exception as e:
            print("ESC/POS image error:", e)
            return None

    # --------------------------------------------------
    # Print receipt
    # --------------------------------------------------
    @pyqtSlot(str, result=str)
    def print_receipt(self, text):
        try:
            hPrinter = win32print.OpenPrinter(self.printer_name)

            win32print.StartDocPrinter(hPrinter, 1, ("CraveHub Receipt", None, "RAW"))
            win32print.StartPagePrinter(hPrinter)

            # ---------- RESET printer state ----------
            win32print.WritePrinter(hPrinter, b"\x1B\x40")  # ESC @ (reset)
            win32print.WritePrinter(hPrinter, b"\x1B\x32")  # ESC 2 = default line spacing (prevents compressed text)
            win32print.WritePrinter(hPrinter, b"\x1D\x4C\x00\x00")  # Left margin = 0
            win32print.WritePrinter(hPrinter, b"\x1D\x57\x80\x01")  # Width = 384
            win32print.WritePrinter(hPrinter, b"\x1B\x61\x00")  # Align LEFT

            # ---------- Print logo ----------
            logo_path = self._get_logo_path()
            if logo_path:
                logo_data = self._image_to_escpos(logo_path)
                if logo_data:
                    win32print.WritePrinter(hPrinter, logo_data)
                    win32print.WritePrinter(hPrinter, b"\n\n")

            # ---------- Print text ----------
            win32print.WritePrinter(
                hPrinter,
                text.encode("cp437", errors="replace")
            )

            # ---------- Feed paper so full receipt prints, then cut ----------
            win32print.WritePrinter(hPrinter, b"\n\n\n\n\n")  # Extra feed so bottom isn't cut off
            win32print.WritePrinter(hPrinter, b"\x1B\x32")     # Reset to default line spacing before cut
            win32print.WritePrinter(hPrinter, b"\x1D\x56\x41\x10")  # Full cut

            win32print.EndPagePrinter(hPrinter)
            win32print.EndDocPrinter(hPrinter)
            win32print.ClosePrinter(hPrinter)

            return '{"success": true}'

        except Exception as e:
            return f'{{"success": false, "error": "{e}"}}'
