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
        Uses GS v 0 (raster format) which is more reliable than ESC *
        max_width: Maximum width in pixels (384 for 80mm thermal printer)
        """
        try:
            # Reduce max_width by 5% to make logo smaller
            max_width = int(max_width * 0.95)
            
            # Open and process image
            img = Image.open(image_path)
            
            # Convert RGBA to RGB if needed (remove transparency)
            if img.mode == 'RGBA':
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
                img = background
            elif img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            
            # Convert to grayscale
            if img.mode != 'L':
                img = img.convert('L')
            
            # Resize to fit printer width while maintaining aspect ratio
            width, height = img.size
            if width > max_width:
                ratio = max_width / width
                new_height = int(height * ratio)
                # Use LANCZOS for better quality
                try:
                    img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                except AttributeError:
                    img = img.resize((max_width, new_height), Image.LANCZOS)
            else:
                # Resize to 95% of original size, then center
                new_width = int(width * 0.95)
                new_height = int(height * 0.95)
                try:
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                except AttributeError:
                    img = img.resize((new_width, new_height), Image.LANCZOS)
            
            # Always center the image on the receipt (384px width)
            receipt_width = 384
            final_width, final_height = img.size
            if final_width < receipt_width:
                # Center the image horizontally
                new_img = Image.new('L', (receipt_width, final_height), 255)  # White background
                x_offset = (receipt_width - final_width) // 2
                new_img.paste(img, (x_offset, 0))
                img = new_img
            
            width, height = img.size
            
            # Apply threshold to convert to pure black and white
            # Threshold at 128 - pixels darker than 128 become black, lighter become white
            threshold = 128
            img = img.point(lambda p: 0 if p < threshold else 255, mode='1')
            
            # Calculate bytes per line (8 pixels per byte, rounded up)
            bytes_per_line = (width + 7) // 8
            
            # Use GS v 0 (raster format) - more reliable than ESC *
            # GS v 0 m xL xH yL yH d1...dk
            # m = 0 (normal), x = width in bytes, y = height in dots
            
            xL = bytes_per_line & 0xFF
            xH = (bytes_per_line >> 8) & 0xFF
            yL = height & 0xFF
            yH = (height >> 8) & 0xFF
            
            escpos_data = bytearray()
            
            # GS v 0 command
            escpos_data.extend(b'\x1D\x76\x30')  # GS v 0
            escpos_data.append(0)  # m = 0 (normal)
            escpos_data.append(xL)
            escpos_data.append(xH)
            escpos_data.append(yL)
            escpos_data.append(yH)
            
            # Get pixel accessor
            pixels = img.load()
            
            # Convert image to bytes (row by row)
            for y in range(height):
                for x in range(0, width, 8):
                    byte = 0
                    for bit in range(8):
                        pixel_x = x + bit
                        if pixel_x < width:
                            # Read pixel value
                            pixel_value = pixels[pixel_x, y]
                            
                            # In mode '1', 0 = black, 255 = white
                            # For ESC/POS, black pixels (0) should set the bit to 1
                            # White pixels (255) should leave the bit as 0
                            if pixel_value == 0:  # Black pixel
                                # Set bit (MSB first, left to right)
                                byte |= (1 << (7 - bit))
                    escpos_data.append(byte)
            
            return bytes(escpos_data)
            
        except Exception as e:
            print(f"Error converting image to ESC/POS: {e}")
            import traceback
            traceback.print_exc()
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
