#!/usr/bin/env python3
"""
Helper script to find your thermal printer's VID/PID
Run this script to list all USB devices and find your printer
"""

try:
    import usb.core
    import usb.util
except ImportError:
    print("ERROR: pyusb not installed")
    print("Install with: pip install pyusb")
    exit(1)

print("=" * 60)
print("USB Device Scanner - Finding Your Thermal Printer")
print("=" * 60)
print()

devices = []
try:
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
            
            vid_hex = hex(device.idVendor)
            pid_hex = hex(device.idProduct)
            
            devices.append({
                'vid': device.idVendor,
                'pid': device.idProduct,
                'vid_hex': vid_hex,
                'pid_hex': pid_hex,
                'vendor': vendor_name,
                'product': product_name
            })
            
            # Highlight potential printers
            is_printer = any(keyword in (vendor_name + " " + product_name).lower() 
                           for keyword in ['printer', 'epson', 'star', 'brother', 'thermal', 'receipt', 'pos'])
            
            marker = " [PRINTER?]" if is_printer else ""
            print(f"VID: {vid_hex:8s} PID: {pid_hex:8s} | {vendor_name:20s} | {product_name:30s}{marker}")
            
        except Exception as e:
            print(f"Error reading device: {e}")

    print()
    print("=" * 60)
    print(f"Found {len(devices)} USB device(s)")
    print("=" * 60)
    print()
    
    # Find potential printers
    potential_printers = [d for d in devices if any(
        keyword in (d['vendor'] + " " + d['product']).lower() 
        for keyword in ['printer', 'epson', 'star', 'brother', 'thermal', 'receipt', 'pos']
    )]
    
    if potential_printers:
        print("Potential Printers Found:")
        print("-" * 60)
        for printer in potential_printers:
            print(f"  {printer['vendor']} {printer['product']}")
            print(f"    VID: {printer['vid_hex']} (decimal: {printer['vid']})")
            print(f"    PID: {printer['pid_hex']} (decimal: {printer['pid']})")
            print(f"    To use this printer, run in browser console:")
            print(f"    window.printerBackend.set_printer_config({printer['vid']}, {printer['pid']}, 0x81, 0x03);")
            print()
    else:
        print("No obvious printers found. Look for your printer in the list above.")
        print("Common thermal printer manufacturers:")
        print("  - Epson (VID usually 0x04B8)")
        print("  - Star Micronics (VID usually 0x0519)")
        print("  - Brother (VID usually 0x04F9)")
        print()
        print("If you see your printer above, note its VID and PID, then configure it:")
        print("  window.printerBackend.set_printer_config(VID, PID, 0x81, 0x03);")
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
