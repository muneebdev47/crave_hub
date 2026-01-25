from PyQt6.QtCore import QObject, pyqtSlot
import traceback
import sys

# Try to import escpos, fallback if not available
try:
    from escpos.printer import Usb
    ESCPOS_AVAILABLE = True
except ImportError:
    ESCPOS_AVAILABLE = False
    print("[PRINTER] Warning: python-escpos not installed. Install with: pip install python-escpos")

# Try to import usb.core for device listing
try:
    import usb.core
    import usb.util
    USB_UTIL_AVAILABLE = True
except ImportError:
    USB_UTIL_AVAILABLE = False
    print("[PRINTER] Note: pyusb not installed. Install with: pip install pyusb (optional, for device listing)")


class PrinterBackend(QObject):
    def __init__(self):
        super().__init__()
        self.printer_vid = None
        self.printer_pid = None
        self.printer_in_ep = 0x81
        self.printer_out_ep = 0x03

    @pyqtSlot(str, result=str)
    def print_receipt(self, text):
        """
        Print receipt to thermal printer.
        Returns JSON string with success/error status.
        """
        if not ESCPOS_AVAILABLE:
            error_msg = "python-escpos library not installed. Install with: pip install python-escpos"
            print(f"[PRINTER ERROR] {error_msg}")
            return '{"success": false, "error": "' + error_msg + '"}'

        try:
            # Try to auto-detect printer or use common defaults
            # Common thermal printer VID/PID combinations:
            printers_to_try = [
                (0x04B8, 0x0202, 0x81, 0x03),  # Epson TM-T20
                (0x04B8, 0x0202, 0x82, 0x01),  # Epson alternative
                (0x0519, 0x0001, 0x81, 0x02),  # Star TSP100
                (0x04F9, 0x2016, 0x81, 0x01),  # Brother QL-700
            ]

            printer = None
            last_error = None
            detected_vid = None
            detected_pid = None

            # If VID/PID are set, try those first
            if self.printer_vid and self.printer_pid:
                try:
                    printer = Usb(
                        self.printer_vid,
                        self.printer_pid,
                        timeout=0,
                        in_ep=self.printer_in_ep,
                        out_ep=self.printer_out_ep
                    )
                    # Try to open to verify connection
                    printer.open()
                    print(f"[PRINTER] Connected to configured printer VID:{hex(self.printer_vid)} PID:{hex(self.printer_pid)}")
                except Exception as e:
                    last_error = str(e)
                    print(f"[PRINTER] Failed to connect to configured printer: {e}")
                    if printer:
                        try:
                            printer.close()
                        except:
                            pass
                    printer = None

            # If not connected, try common printers
            if printer is None:
                print("[PRINTER] Attempting to auto-detect printer...")
                for vid, pid, in_ep, out_ep in printers_to_try:
                    try:
                        print(f"[PRINTER] Trying VID:{hex(vid)} PID:{hex(pid)}...")
                        printer = Usb(vid, pid, timeout=0, in_ep=in_ep, out_ep=out_ep)
                        # Try to open the printer to verify connection
                        printer.open()
                        print(f"[PRINTER] ✓ Successfully connected to printer VID:{hex(vid)} PID:{hex(pid)}")
                        self.printer_vid = vid
                        self.printer_pid = pid
                        self.printer_in_ep = in_ep
                        self.printer_out_ep = out_ep
                        detected_vid = vid
                        detected_pid = pid
                        break
                    except Exception as e:
                        error_str = str(e)
                        last_error = error_str
                        # Only log if it's not just "device not found" (expected for wrong printers)
                        if "not found" not in error_str.lower() or vid == printers_to_try[-1][0]:
                            print(f"[PRINTER] ✗ Failed to connect to VID:{hex(vid)} PID:{hex(pid)}: {error_str[:100]}")
                        if printer:
                            try:
                                printer.close()
                            except:
                                pass
                        printer = None
                        continue

            if printer is None:
                print(f"[PRINTER ERROR] Could not connect to any thermal printer")
                print(f"[PRINTER] Last error: {last_error}")
                print("[PRINTER] Troubleshooting:")
                print("  1. Ensure printer is powered on and connected via USB")
                print("  2. On macOS: System Preferences > Security & Privacy > Privacy > USB")
                print("     - Grant USB access to Python/Terminal/your app")
                print("  3. Try unplugging and reconnecting the printer")
                print("  4. Check if printer appears in system device list")
                print("  5. Try a different USB port (preferably USB 2.0)")
                print("  6. Avoid USB hubs - connect directly to computer")
                print("  7. Your printer might not be in the auto-detect list")
                print("     - Use list_usb_devices() to find your printer's VID/PID")
                print("     - Then use set_printer_config(VID, PID, IN_EP, OUT_EP)")
                
                # Provide more specific error message
                if "not found" in str(last_error).lower() or "device not found" in str(last_error).lower():
                    error_msg = "Printer not found. Please check:\n1. Printer is connected and powered on\n2. USB cable is properly connected\n3. On macOS: Grant USB permissions in System Preferences\n4. Your printer model might not be auto-detected - check terminal for VID/PID"
                elif "permission" in str(last_error).lower() or "denied" in str(last_error).lower():
                    error_msg = "Permission denied. On macOS, grant USB access in System Preferences > Security & Privacy > Privacy > USB"
                else:
                    error_msg = f"Could not connect to printer: {last_error[:200]}"
                
                return '{"success": false, "error": "' + error_msg.replace('"', '\\"').replace('\n', ' ') + '"}'

            # Ensure printer is open before printing
            try:
                if not printer.device:
                    printer.open()
            except Exception as e:
                error_msg = f"Failed to open printer: {str(e)}"
                print(f"[PRINTER ERROR] {error_msg}")
                return '{"success": false, "error": "' + error_msg.replace('"', '\\"') + '"}'

            # Print the receipt
            printer.set(align="center", bold=True, font="a", width=1, height=1)
            printer.text("\n")
            printer.text("CRAVEHUB CAFE\n")
            printer.set(align="left", bold=False, font="a", width=1, height=1)
            printer.text("\n")

            # Print the formatted text
            printer.text(text)

            # Cut paper
            printer.cut()
            
            # Close the printer connection
            try:
                printer.close()
            except:
                pass

            print("[PRINTER] Receipt printed successfully")
            return '{"success": true, "message": "Receipt printed successfully"}'

        except Exception as e:
            error_msg = f"Print error: {str(e)}"
            print(f"[PRINTER ERROR] {error_msg}")
            print(traceback.format_exc())
            
            # Provide helpful error messages
            if "Device not found" in str(e) or "not found" in str(e).lower():
                error_msg = "Printer not found. Please check:\n1. Printer is connected and powered on\n2. USB cable is properly connected\n3. On macOS: Grant USB permissions in System Preferences"
            elif "Permission" in str(e) or "denied" in str(e).lower():
                error_msg = "Permission denied. On macOS, grant USB access in System Preferences > Security & Privacy > Privacy > USB"
            
            return '{"success": false, "error": "' + error_msg.replace('"', '\\"').replace('\n', ' ') + '"}'

    @pyqtSlot(int, int, int, int, result=str)
    def set_printer_config(self, vid, pid, in_ep, out_ep):
        """
        Set printer USB configuration manually.
        Returns success status.
        """
        try:
            self.printer_vid = vid
            self.printer_pid = pid
            self.printer_in_ep = in_ep
            self.printer_out_ep = out_ep
            print(f"[PRINTER] Configuration set: VID:{hex(vid)} PID:{hex(pid)}")
            return '{"success": true, "message": "Printer configuration updated"}'
        except Exception as e:
            return '{"success": false, "error": "' + str(e).replace('"', '\\"') + '"}'

    @pyqtSlot(result=str)
    def test_printer(self):
        """Test printer connection"""
        test_text = "==================================\n"
        test_text += "      PRINTER TEST\n"
        test_text += "==================================\n"
        test_text += "If you can read this,\n"
        test_text += "your printer is working!\n"
        test_text += "==================================\n\n\n"
        return self.print_receipt(test_text)

    @pyqtSlot(result=str)
    def list_usb_devices(self):
        """List available USB devices (for debugging)"""
        if not USB_UTIL_AVAILABLE:
            return '{"success": false, "error": "pyusb not installed. Install with: pip install pyusb"}'
        
        try:
            import json
            devices = []
            print("[PRINTER] Scanning for USB devices...")
            for device in usb.core.find(find_all=True):
                try:
                    vendor_name = "Unknown"
                    product_name = "Unknown"
                    try:
                        if device.iManufacturer:
                            vendor_name = usb.util.get_string(device, device.iManufacturer)
                        if device.iProduct:
                            product_name = usb.util.get_string(device, device.iProduct)
                    except:
                        pass
                    
                    device_info = {
                        "vid": hex(device.idVendor),
                        "pid": hex(device.idProduct),
                        "vid_decimal": device.idVendor,
                        "pid_decimal": device.idProduct,
                        "vendor": vendor_name,
                        "product": product_name
                    }
                    devices.append(device_info)
                    print(f"[PRINTER] Found: {vendor_name} {product_name} (VID:{hex(device.idVendor)} PID:{hex(device.idProduct)})")
                except Exception as e:
                    print(f"[PRINTER] Error reading device info: {e}")
                    devices.append({
                        "vid": hex(device.idVendor),
                        "pid": hex(device.idProduct),
                        "vid_decimal": device.idVendor,
                        "pid_decimal": device.idProduct,
                        "vendor": "Unknown",
                        "product": "Unknown"
                    })
            
            print(f"[PRINTER] Found {len(devices)} USB device(s)")
            return json.dumps({"success": True, "devices": devices})
        except Exception as e:
            import json
            error_msg = str(e)
            print(f"[PRINTER ERROR] Failed to list USB devices: {error_msg}")
            return json.dumps({"success": False, "error": error_msg})
