// ===============================
// THERMAL RECEIPT (ESC/POS)
// ===============================

// safeDbQuery should be loaded from db_utils.js
// If not available, wait for it or use fallback
if (typeof safeDbQuery === 'undefined') {
    console.warn("[PRINT] safeDbQuery not found, will wait for db_utils.js");
}

function generateReceiptText(order, items) {
    const lines = [];
    const date = new Date(order.created_at);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Header
    lines.push("==================================");
    lines.push("      CRAVEHUB CAFE");
    lines.push("==================================");
    lines.push("");
    
    // Order Info
    lines.push(`Receipt #: ${String(order.id).padStart(6, '0')}`);
    lines.push(`Date: ${dateStr} ${timeStr}`);
    lines.push(`Type: ${order.order_type || 'Takeaway'}`);
    
    if (order.customer_name) {
        lines.push(`Customer: ${order.customer_name}`);
    }
    if (order.customer_phone) {
        lines.push(`Phone: ${order.customer_phone}`);
    }
    if (order.table_number) {
        lines.push(`Table: ${order.table_number}`);
    }
    
    lines.push("----------------------------------");
    lines.push("ITEM                QTY    AMOUNT");
    lines.push("----------------------------------");

    // Items
    items.forEach(item => {
        const itemTotal = (item.price * item.quantity).toFixed(2);
        const name = item.name.length > 18 ? item.name.substring(0, 15) + '...' : item.name;
        const qty = String(item.quantity).padStart(3);
        const total = `Rs.${itemTotal}`.padStart(10);
        lines.push(`${name.padEnd(20)}${qty}${total}`);
    });

    // Total
    lines.push("----------------------------------");
    lines.push(`TOTAL:${' '.repeat(20)}Rs. ${parseFloat(order.total).toFixed(2)}`);
    lines.push("==================================");
    lines.push("");
    lines.push("   Thank you for your order!");
    lines.push("");
    lines.push("  Developed by Muneeb");
    lines.push("   Phone: 03256000110");
    lines.push("");
    lines.push(""); // Extra blank lines for cutting

    return lines.join("\n");
}

async function printOrderReceipt(orderId, dbBackend) {
    console.log(`[PRINT] Starting thermal receipt print for Order ID: ${orderId}`);
    
    try {
        const orderSql = `SELECT * FROM orders WHERE id = ?`;
        const orders = await safeDbQuery(orderSql, [orderId], dbBackend);
        
        if (!orders || orders.length === 0) {
            console.error(`[PRINT] Order #${orderId} not found`);
            alert("Order not found");
            return;
        }

        const itemsSql = `
            SELECT oi.quantity, oi.price, mi.name, mi.category
            FROM order_items oi
            JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE oi.order_id = ?
        `;
        const items = await safeDbQuery(itemsSql, [orderId], dbBackend);
        
        console.log(`[PRINT] Order #${orderId} found, ${items.length} items`);

        const receiptText = generateReceiptText(orders[0], items);
        console.log(`[PRINT] Receipt text generated (${receiptText.length} chars)`);

        // Wait for printer backend to be available
        let printerBackend = window.printerBackend;
        if (!printerBackend) {
            console.log("[PRINT] Waiting for printer backend...");
            // Wait up to 3 seconds for printer backend and WebChannel
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                printerBackend = window.printerBackend;
                // Also check if WebChannel is initialized
                if (printerBackend && window._webChannelInitialized) {
                    console.log("[PRINT] Printer backend and WebChannel ready");
                    break;
                }
            }
        }
        
        // Additional check: wait for WebChannel to be fully ready
        if (printerBackend && !window._webChannelInitialized) {
            console.log("[PRINT] Waiting for WebChannel initialization...");
            await new Promise((resolve) => {
                if (window._webChannelInitialized) {
                    resolve();
                } else {
                    window.addEventListener('webchannel-ready', resolve, { once: true });
                    // Timeout after 2 seconds
                    setTimeout(resolve, 2000);
                }
            });
        }

        if (!printerBackend) {
            console.error("[PRINT] ERROR: Printer backend not available");
            alert("Thermal printer not available. Please check:\n1. Printer is connected\n2. Application is restarted after connecting printer\n3. Check terminal for printer initialization messages");
            return;
        }

        if (typeof printerBackend.print_receipt !== 'function') {
            console.error("[PRINT] ERROR: print_receipt is not a function");
            alert("Printer backend method not available. Please restart the application.");
            return;
        }

        console.log(`[PRINT] Sending receipt to thermal printer...`);
        
        try {
            // Call the printer method - PyQt6 WebChannel with result=str returns synchronously
            // But we'll handle it carefully to avoid callback errors
            let result;
            
            // Small delay to ensure WebChannel callback queue is clear
            await new Promise(resolve => setTimeout(resolve, 100));
            
            try {
                // Direct call - PyQt6 WebChannel should handle this synchronously
                result = printerBackend.print_receipt(receiptText);
                console.log(`[PRINT] Method called, result type: ${typeof result}`);
            } catch (callError) {
                console.error(`[PRINT] ERROR calling print_receipt:`, callError);
                // Check if it's a WebChannel callback error
                if (callError.message && (callError.message.includes('execCallbacks') || callError.message.includes('callback'))) {
                    console.warn(`[PRINT] WebChannel callback error - retrying after delay...`);
                    // Wait a bit and try again
                    await new Promise(resolve => setTimeout(resolve, 500));
                    try {
                        result = printerBackend.print_receipt(receiptText);
                    } catch (retryError) {
                        throw new Error('WebChannel error. Please restart the application and try again.');
                    }
                } else {
                    throw new Error(`Failed to call printer: ${callError.message}`);
                }
            }
            
            // Handle result - PyQt6 methods with result=str return the string directly
            if (typeof result === 'string') {
                try {
                    const response = JSON.parse(result);
                    if (response.success) {
                        console.log(`[PRINT] SUCCESS: ${response.message || 'Receipt printed successfully'}`);
                    } else {
                        console.error(`[PRINT] ERROR: ${response.error}`);
                        alert(`Printer Error: ${response.error}\n\nPlease check:\n1. Printer is connected and powered on\n2. USB cable is properly connected\n3. On macOS: Grant USB permissions in System Preferences\n4. Printer drivers are installed`);
                    }
                } catch (parseError) {
                    // If result is not JSON, log it
                    console.log(`[PRINT] Received non-JSON response: ${result}`);
                    if (result.includes('error') || result.includes('Error')) {
                        alert(`Printer Error: ${result}`);
                    } else {
                        console.log(`[PRINT] Assuming success (response: ${result})`);
                    }
                }
            } else if (result && typeof result.then === 'function') {
                // Handle Promise if returned (shouldn't happen with PyQt6, but just in case)
                try {
                    const response = await result;
                    if (typeof response === 'string') {
                        const parsed = JSON.parse(response);
                        if (parsed.success) {
                            console.log(`[PRINT] SUCCESS: ${parsed.message || 'Receipt printed successfully'}`);
                        } else {
                            console.error(`[PRINT] ERROR: ${parsed.error}`);
                            alert(`Printer Error: ${parsed.error}`);
                        }
                    }
                } catch (promiseError) {
                    console.error(`[PRINT] ERROR handling promise:`, promiseError);
                    alert(`Error printing: ${promiseError.message}`);
                }
            } else if (result === undefined || result === null) {
                console.warn(`[PRINT] No response from printer backend`);
                alert("No response from printer. Check terminal for error messages.");
            } else {
                console.log(`[PRINT] Received unexpected response type:`, typeof result, result);
            }
        } catch (error) {
            console.error(`[PRINT] ERROR calling printer:`, error);
            console.error(`[PRINT] Error stack:`, error.stack);
            alert(`Error printing: ${error.message}\n\nCheck terminal for detailed error messages.`);
        }
    } catch (error) {
        console.error(`[PRINT] ERROR printing receipt:`, error);
        alert("Error printing receipt: " + error.message);
    }
}

// ===============================
// HTML INVOICE (A4 / NORMAL PRINTER)
// ===============================

function generateInvoiceHTML(order, items) {
    const date = new Date(order.created_at).toLocaleString();
    const customerInfo = order.order_type === 'Table'
        ? `<p><strong>Table:</strong> ${order.table_number || 'N/A'}</p>`
        : `<p><strong>Customer:</strong> ${order.customer_name || 'N/A'}</p>
           ${order.customer_phone ? `<p><strong>Phone:</strong> ${order.customer_phone}</p>` : ''}`;

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice #${order.id}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .header h1 { margin: 0; font-size: 24px; }
                .header h2 { margin: 5px 0; font-size: 18px; color: #666; }
                .info { margin: 10px 0; }
                .items { margin: 20px 0; }
                .item-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ccc; }
                .item-name { flex: 2; }
                .item-qty { flex: 1; text-align: center; }
                .item-price { flex: 1; text-align: right; }
                .total { margin-top: 20px; padding-top: 10px; border-top: 2px solid #000; text-align: right; font-size: 18px; font-weight: bold; }
                .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>CraveHub Cafe</h1>
                <h2>Invoice</h2>
            </div>
            <div class="info">
                <p><strong>Invoice #:</strong> ${order.id}</p>
                <p><strong>Order Type:</strong> ${order.order_type}</p>
                ${customerInfo}
                <p><strong>Order Date:</strong> ${date}</p>
                <p><strong>Status:</strong> ${order.order_status || 'Completed'}</p>
            </div>
            <div class="items">
                <div class="item-row" style="font-weight: bold; border-bottom: 2px solid #000;">
                    <div class="item-name">Item</div>
                    <div class="item-qty">Qty</div>
                    <div class="item-price">Price</div>
                </div>
                ${items.map(item => `
                    <div class="item-row">
                        <div class="item-name">${item.name}</div>
                        <div class="item-qty">${item.quantity}</div>
                        <div class="item-price">Rs. ${parseFloat(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="total">
                <p>Total: Rs. ${parseFloat(order.total).toFixed(2)}</p>
            </div>
            <div class="footer">
                <p>Thank you for your business!</p>
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
        </body>
        </html>
    `;
}

async function printInvoice(orderId, dbBackend) {
    console.log(`[PRINT] Starting invoice print for Order ID: ${orderId}`);
    
    try {
        const orderSql = `SELECT * FROM orders WHERE id = ?`;
        const orders = await safeDbQuery(orderSql, [orderId], dbBackend);
        
        if (!orders || orders.length === 0) {
            console.error(`[PRINT] Order #${orderId} not found`);
            alert("Order not found");
            return;
        }

        const itemsSql = `
            SELECT oi.quantity, oi.price, mi.name, mi.category
            FROM order_items oi
            JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE oi.order_id = ?
        `;
        const items = await safeDbQuery(itemsSql, [orderId], dbBackend);

        const html = generateInvoiceHTML(orders[0], items);
        openPrintWindow(html);
        console.log(`[PRINT] Invoice print window opened`);
    } catch (error) {
        console.error(`[PRINT] ERROR printing invoice:`, error);
        alert("Error generating invoice: " + error.message);
    }
}

function openPrintWindow(html) {
    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) {
        alert("Please allow popups to print invoices");
        return;
    }
    w.document.write(html);
    w.document.close();
    w.onload = () => {
        setTimeout(() => w.print(), 250);
    };
}

// Make functions globally accessible
window.printOrderReceipt = printOrderReceipt;
window.printInvoice = printInvoice;
