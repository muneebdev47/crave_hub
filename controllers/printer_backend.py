from PyQt6.QtCore import QObject, pyqtSlot
import win32print
import sys


class PrinterBackend(QObject):
    def __init__(self):
        super().__init__()

        if sys.platform != "win32":
            raise RuntimeError("Windows only")

        self.printer_name = win32print.GetDefaultPrinter()

    @pyqtSlot(str, result=str)
    def print_receipt(self, text):
        try:
            hPrinter = win32print.OpenPrinter(self.printer_name)

            win32print.StartDocPrinter(hPrinter, 1, ("Receipt", None, "RAW"))
            win32print.StartPagePrinter(hPrinter)

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
