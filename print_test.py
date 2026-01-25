import win32print
import win32ui

PRINTER_NAME = win32print.GetDefaultPrinter()
# or explicitly:
# PRINTER_NAME = "POS-80"

receipt = """
        CRAVE HUB
--------------------------
Burger        2   500
Fries         1   200
Burger        2   500
Fries         1   200
--------------------------
TOTAL             700

Thank you!
"""

hPrinter = win32print.OpenPrinter(PRINTER_NAME)
try:
    hJob = win32print.StartDocPrinter(hPrinter, 1, ("Receipt", None, "RAW"))
    win32print.StartPagePrinter(hPrinter)
    win32print.WritePrinter(hPrinter, receipt.encode("utf-8"))
    win32print.EndPagePrinter(hPrinter)
    win32print.EndDocPrinter(hPrinter)
finally:
    win32print.ClosePrinter(hPrinter)
