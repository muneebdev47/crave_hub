from PyQt6.QtCore import QObject, pyqtSlot
import win32print
import sys
from pathlib import Path
from PIL import Image


class PrinterBackend(QObject):
    def __init__(self):
        super().__init__()

        if sys.platform != "win32":
            raise RuntimeError("Windows only")

        self.printer_name = win32print.GetDefaultPrinter()

    def _get_logo_path(self):
        """Get the path to the logo file"""
        try:
            # Try to get path relative to executable (PyInstaller)
            base_path = Path(sys._MEIPASS)
        except AttributeError:
            # Development mode - use project root
            base_path = Path(__file__).resolve().parent.parent
        
        # Try logo.png first, then logo.ico
        logo_png = base_path / "assets" / "logo.png"
        logo_ico = base_path / "assets" / "logo.ico"
        
        if logo_png.exists():
            return logo_png
        elif logo_ico.exists():
            return logo_ico
        else:
            return None

    def _image_to_escpos(self, image_path, max_width=384):
        """
        Convert image to ESC/POS bitmap format (black and white)
        max_width: Maximum width in pixels (384 for 80mm thermal printer)
        """
        try:
            # Open and process image
            img = Image.open(image_path)
            
            # Convert to grayscale
            if img.mode != 'L':
                img = img.convert('L')
            
            # Resize to fit printer width while maintaining aspect ratio
            width, height = img.size
            if width > max_width:
                ratio = max_width / width
                new_height = int(height * ratio)
                # Use LANCZOS for better quality (Pillow 9+ uses Image.Resampling.LANCZOS, older versions use Image.LANCZOS)
                try:
                    img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                except AttributeError:
                    img = img.resize((max_width, new_height), Image.LANCZOS)
            else:
                # Center the image if it's smaller than max_width
                new_img = Image.new('L', (max_width, height), 255)  # White background
                x_offset = (max_width - width) // 2
                new_img.paste(img, (x_offset, 0))
                img = new_img
            
            # Threshold to black and white (128 is the threshold)
            img = img.point(lambda x: 0 if x < 128 else 255, mode='1')
            
            width, height = img.size
            
            # Convert to ESC/POS bitmap format
            # ESC * m nL nH d1...dk (bitmap command)
            # m = 0 (8-dot single-density), 1 (8-dot double-density), 32 (24-dot single-density), 33 (24-dot double-density)
            # We'll use mode 0 for 8-dot single-density
            
            # Calculate bytes per line (8 pixels per byte)
            bytes_per_line = (width + 7) // 8
            nL = bytes_per_line & 0xFF
            nH = (bytes_per_line >> 8) & 0xFF
            
            escpos_data = bytearray()
            
            # Process image row by row
            pixels = img.load()
            for y in range(height):
                # ESC * command
                escpos_data.extend(b'\x1B\x2A\x00')  # ESC * 0 (8-dot single-density)
                escpos_data.append(nL)
                escpos_data.append(nH)
                
                # Convert row to bytes
                for x in range(0, width, 8):
                    byte = 0
                    for bit in range(8):
                        if x + bit < width:
                            # Invert: 0 (black) becomes 1, 255 (white) becomes 0
                            pixel = pixels[x + bit, y]
                            if pixel == 0:  # Black pixel
                                byte |= (1 << (7 - bit))
                    escpos_data.append(byte)
            
            return bytes(escpos_data)
            
        except Exception as e:
            print(f"Error converting image to ESC/POS: {e}")
            return None

    @pyqtSlot(str, result=str)
    def print_receipt(self, text):
        """
        Print receipt with logo at the top
        text: Receipt text in ESC/POS format
        """
        try:
            hPrinter = win32print.OpenPrinter(self.printer_name)

            win32print.StartDocPrinter(hPrinter, 1, ("Receipt", None, "RAW"))
            win32print.StartPagePrinter(hPrinter)

            # Print logo at the top
            logo_path = self._get_logo_path()
            if logo_path:
                logo_data = self._image_to_escpos(logo_path)
                if logo_data:
                    win32print.WritePrinter(hPrinter, logo_data)
                    # Add some spacing after logo
                    win32print.WritePrinter(hPrinter, b"\n\n")

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
