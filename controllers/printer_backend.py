from PyQt6.QtCore import QObject, pyqtSlot
import win32print

class PrinterBackend(QObject):
    def __init__(self):
        super().__init__()
        self.printer_name = win32print.GetDefaultPrinter()

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
                win32print.WritePrinter(hPrinter, text.encode("utf-8"))
                win32print.EndPagePrinter(hPrinter)
                win32print.EndDocPrinter(hPrinter)
            finally:
                win32print.ClosePrinter(hPrinter)

            return '{"success": true, "message": "Printed successfully"}'

        except Exception as e:
            return f'{{"success": false, "error": "{str(e)}"}}'
