// ===============================
// DARK-THEMED CONFIRM MODAL (replaces native confirm - fixes white/invisible popups)
// ===============================

const CONFIRM_MODAL_ID = "print-confirm-modal";

function showConfirmModal(message) {
    return new Promise((resolve) => {
        let wrap = document.getElementById(CONFIRM_MODAL_ID);
        if (!wrap) {
            wrap = document.createElement("div");
            wrap.id = CONFIRM_MODAL_ID;
            wrap.innerHTML = `
                <div class="print-confirm-overlay" id="print-confirm-overlay"></div>
                <div class="print-confirm-box">
                    <p class="print-confirm-message" id="print-confirm-message"></p>
                    <div class="print-confirm-actions">
                        <button type="button" class="print-confirm-btn print-confirm-yes" id="print-confirm-yes">Yes</button>
                        <button type="button" class="print-confirm-btn print-confirm-no" id="print-confirm-no">No</button>
                    </div>
                </div>
            `;
            const style = document.createElement("style");
            style.id = "print-confirm-modal-styles";
            style.textContent = `
                #${CONFIRM_MODAL_ID} { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; }
                .print-confirm-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.85); z-index: 0; }
                .print-confirm-box { position: relative; z-index: 1; background: #1e1e1e; color: #fff; padding: 24px 28px; border-radius: 12px; max-width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); border: 1px solid #2A2A2A; }
                .print-confirm-message { margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #eee; white-space: pre-wrap; }
                .print-confirm-actions { display: flex; gap: 12px; justify-content: flex-end; }
                .print-confirm-btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
                .print-confirm-yes { background: #4caf50; color: #fff; }
                .print-confirm-yes:hover { background: #45a049; }
                .print-confirm-no { background: #2A2A2A; color: #eee; }
                .print-confirm-no:hover { background: #3E3E3E; }
            `;
            document.head.appendChild(style);
            document.body.appendChild(wrap);
        }

        const msgEl = document.getElementById("print-confirm-message");
        const yesBtn = document.getElementById("print-confirm-yes");
        const noBtn = document.getElementById("print-confirm-no");
        const overlay = document.getElementById("print-confirm-overlay");

        if (msgEl) msgEl.textContent = message;
        wrap.style.display = "flex";

        function close(val) {
            wrap.style.display = "none";
            yesBtn.removeEventListener("click", onYes);
            noBtn.removeEventListener("click", onNo);
            overlay.removeEventListener("click", onNo);
            resolve(val);
        }
        function onYes() { close(true); }
        function onNo() { close(false); }

        yesBtn.addEventListener("click", onYes);
        noBtn.addEventListener("click", onNo);
        overlay.addEventListener("click", onNo);
    });
}

const ALERT_MODAL_ID = "print-alert-modal";

function showAlertModal(message) {
    return new Promise((resolve) => {
        let wrap = document.getElementById(ALERT_MODAL_ID);
        if (!wrap) {
            wrap = document.createElement("div");
            wrap.id = ALERT_MODAL_ID;
            wrap.innerHTML = `
                <div class="print-alert-overlay" id="print-alert-overlay"></div>
                <div class="print-alert-box">
                    <p class="print-alert-message" id="print-alert-message"></p>
                    <div class="print-alert-actions">
                        <button type="button" class="print-alert-btn" id="print-alert-ok">OK</button>
                    </div>
                </div>
            `;
            const style = document.createElement("style");
            style.id = "print-alert-modal-styles";
            style.textContent = `
                #${ALERT_MODAL_ID} { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; }
                .print-alert-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.85); z-index: 0; }
                .print-alert-box { position: relative; z-index: 1; background: #1e1e1e; color: #fff; padding: 24px 28px; border-radius: 12px; max-width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); border: 1px solid #2A2A2A; }
                .print-alert-message { margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #eee; white-space: pre-wrap; }
                .print-alert-actions { display: flex; justify-content: flex-end; }
                .print-alert-btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; background: #4caf50; color: #fff; }
                .print-alert-btn:hover { background: #45a049; }
            `;
            if (!document.getElementById("print-alert-modal-styles")) document.head.appendChild(style);
            document.body.appendChild(wrap);
        }
        const msgEl = document.getElementById("print-alert-message");
        const okBtn = document.getElementById("print-alert-ok");
        if (msgEl) msgEl.textContent = message;
        wrap.style.display = "flex";
        function close() {
            wrap.style.display = "none";
            okBtn.removeEventListener("click", close);
            resolve();
        }
        okBtn.addEventListener("click", close);
    });
}

// ===============================
// THERMAL RECEIPT (ESC/POS)
// ===============================


function generateReceiptText(order, items) {
    const lines = [];
    const date = new Date(order.created_at);
    const printDate = new Date();
    
    // ESC/POS commands for formatting
    const ESC = '\x1B';
    const BOLD_ON = ESC + '\x45\x01';  // ESC E 1 - Turn on emphasized/bold
    const BOLD_OFF = ESC + '\x45\x00'; // ESC E 0 - Turn off emphasized/bold
    
    // Helper function to wrap text with bold formatting
    const bold = (text) => BOLD_ON + text + BOLD_OFF;
    
    // Format dates
    const formatDate = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };
    
    const formatTime = (d) => {
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    };
    
    const orderDate = formatDate(date);
    const printDateTime = `${formatDate(printDate)} ${formatTime(printDate)}`;
    const orderNo = `CHC-${String(order.id).padStart(3, '0')}`;
    
    // Header with logo area - make logo bold
    lines.push(bold("       CRAVEHUB CAFE "));
    lines.push("");
    lines.push("Interloop Apparel # 2 Hostels");
    lines.push("+92 304 04 65 000");
    
    // Order Information Section - bold headings only
    lines.push(bold("Order No:") + "        " + orderNo);
    lines.push(bold("Order Date:") + "      " + orderDate);
    lines.push(bold("Print Date & Time:") + " " + printDateTime);
    lines.push(bold("Sales Associate:") + "  CRAVEHUB");
    
    // Customer information - bold headings only
    if (order.customer_name) {
        const customerName = order.customer_name.startsWith('Mr. ') || order.customer_name.startsWith('Ms. ') ? order.customer_name : `Mr. ${order.customer_name}`;
        lines.push(bold("Customer:") + "        " + customerName);
    }
    
    if (order.customer_phone) {
        lines.push(bold("Phone:") + "           " + order.customer_phone);
    }
    
    if (order.table_number) {
        lines.push(bold("Table:") + "           " + order.table_number);
    }
    
    // Address - for delivery orders use customer_address, otherwise default - bold heading only
    if (order.order_type === 'Delivery' && order.customer_address) {
        lines.push(bold("Address:") + "         " + order.customer_address);
    } else if (order.order_type !== 'Delivery') {
        // For non-delivery orders, show default address
        lines.push(bold("Address:") + "         Interloop Apparel #2 Hostels");
    }
    lines.push(bold("Order Due Date:") + "  " + orderDate);
    lines.push("");
    
    // Items Table Header - bold header row
    lines.push(bold("Sr.       Product            Qty   Price   Total"));
    lines.push("------------------------------------------------");
    
    // Calculate totals
    let subtotal = 0;
    let totalQty = 0;
    const discountPercent = order.discount_percentage || 0;
    
    // Items
    items.forEach((item, index) => {
        const srNo = String(index + 1).padStart(2);
        const product = item.name.length > 18 ? item.name.substring(0, 15) + '...' : item.name.padEnd(15);
        const qty = String(item.quantity).padStart(3);
        const price = String(item.price).padStart(5);
        const itemTotal = (item.price * item.quantity);
        const amount = String(itemTotal.toFixed(0)).padStart(6);
        
        subtotal += itemTotal;
        totalQty += item.quantity;
        
        lines.push(`${srNo}    ${product}   ${qty}  ${price}  ${amount}`);
    });
    
    lines.push("------------------------------------------------");
    
    // Summary Section - bold headings only
    const discountAmount = (subtotal * discountPercent) / 100;
    const netAmount = subtotal - discountAmount;
    const paid = order.payment_status === 'paid' ? netAmount : 0;
    const balance = netAmount - paid;
    
    lines.push(bold("No of Pieces:") + "     " + totalQty);
    lines.push(bold("Gross Amount:") + "     " + subtotal.toFixed(0));
    lines.push(bold("Discount:") + "         " + discountAmount.toFixed(0));
    lines.push(bold("Net Amount:") + "       " + netAmount.toFixed(0));
    lines.push(bold("Paid:") + "             " + paid.toFixed(0));
    lines.push(bold("Balance:") + "          " + balance.toFixed(0));
    lines.push("");
    
    // Notes Section - bold heading only
    lines.push(bold("Note:"));
    lines.push("Thank you for choosing us.");
    lines.push("");
    
    // Payment Details - bold headings only
    lines.push(bold("Bank:") + "             Meezan Bank");
    lines.push(bold("Name:") + "             Awais Amjad");
    lines.push(bold("Account Number:") + "   2647 0113908048");
    lines.push(bold("IBAN:") + "              PK72 MEZN 0026 4701 1390 8048");
    lines.push(bold("JazzCash:") + "         0301 04 65 000");
    lines.push("");
    lines.push("");
    lines.push("Developer:  Muneeb 0325 6000 110");
    lines.push("");
    lines.push("");
    lines.push("");

    return lines.join("\n");
}

async function printOrderReceipt(orderId, dbBackend) {
    const orderSql = `SELECT * FROM orders WHERE id = ?`;
    const orders = await safeDbQuery(orderSql, [orderId]);
    if (!orders.length) {
        if (typeof showAlertModal === 'function') await showAlertModal("Order not found");
        else alert("Order not found");
        return;
    }

    const itemsSql = `
        SELECT oi.quantity, oi.price, mi.name
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
    `;
    const items = await safeDbQuery(itemsSql, [orderId]);

    const receiptText = generateReceiptText(orders[0], items);

    // Wait for printer backend to be available (up to 5 seconds)
    let printerBackend = window.printerBackend;
    console.log(`[PRINT] Checking printer backend... Available: ${!!printerBackend}, WebChannel initialized: ${!!window._webChannelInitialized}`);
    
    // If not available, wait for WebChannel to initialize first
    if (!printerBackend || !window._webChannelInitialized) {
        console.log("[PRINT] Printer backend or WebChannel not ready, waiting...");
        
        // First, wait for WebChannel to be initialized (up to 5 seconds)
        if (!window._webChannelInitialized) {
            console.log("[PRINT] Waiting for WebChannel initialization...");
            let webChannelReady = false;
            
            // Check if already initialized
            if (window._webChannelInitialized) {
                webChannelReady = true;
            } else {
                // Wait for the event or timeout
                await new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                        if (window._webChannelInitialized) {
                            clearInterval(checkInterval);
                            webChannelReady = true;
                            console.log("[PRINT] WebChannel initialized detected");
                            resolve();
                        }
                    }, 100);
                    
                    // Listen for the event
                    window.addEventListener('webchannel-ready', () => {
                        clearInterval(checkInterval);
                        webChannelReady = true;
                        console.log("[PRINT] WebChannel ready event received");
                        resolve();
                    }, { once: true });
                    
                    // Timeout after 5 seconds
                    setTimeout(() => {
                        clearInterval(checkInterval);
                        console.log("[PRINT] WebChannel wait timeout after 5 seconds");
                        resolve();
                    }, 5000);
                });
            }
        }
        
        // Now wait for printer backend to be available (up to 3 more seconds)
        if (!printerBackend) {
            console.log("[PRINT] Waiting for printer backend to be available...");
            for (let i = 0; i < 30; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                printerBackend = window.printerBackend;
                
                // Also try to get it from channel objects if available
                if (!printerBackend && typeof qt !== 'undefined' && qt.webChannelTransport) {
                    try {
                        // Try to access through QWebChannel if it exists
                        if (typeof QWebChannel !== 'undefined') {
                            // Check if we can access the channel
                            console.log("[PRINT] Attempting to access printer backend through WebChannel...");
                        }
                    } catch (e) {
                        console.log("[PRINT] Could not access WebChannel directly:", e);
                    }
                }
                
                if (printerBackend) {
                    console.log(`[PRINT] Printer backend available after ${(i + 1) * 100}ms`);
                    break;
                }
            }
        }
    }

    if (!printerBackend) {
        console.error("[PRINT] ERROR: Printer backend still not available after waiting");
        console.error("[PRINT] window.printerBackend:", window.printerBackend);
        console.error("[PRINT] window._webChannelInitialized:", window._webChannelInitialized);
        console.error("[PRINT] typeof qt:", typeof qt);
        console.error("[PRINT] typeof QWebChannel:", typeof QWebChannel);
        
        // Try one more time to get printer backend - check if WebChannel exists but printerBackend wasn't set
        if (!printerBackend && typeof QWebChannel !== 'undefined' && typeof qt !== 'undefined' && qt.webChannelTransport) {
            console.log("[PRINT] WebChannel transport available but printerBackend not set, checking...");
            // Don't re-initialize, just wait a bit more and check again
            await new Promise(resolve => setTimeout(resolve, 1000));
            printerBackend = window.printerBackend;
            
            if (printerBackend) {
                console.log("[PRINT] Printer backend found after additional wait");
            }
        }
        
        if (!printerBackend) {
            const errorMsg = "Printer backend not available. Please:\n1. Restart the application\n2. Check terminal for printer initialization messages\n3. Ensure the printer is connected";
            if (typeof showAlertModal === 'function') await showAlertModal(errorMsg);
            else alert(errorMsg);
            return;
        }
    }
    
    console.log("[PRINT] Printer backend confirmed available, proceeding with print...");

    if (typeof printerBackend.print_receipt !== 'function') {
        const errorMsg = "Printer method not available. Please restart the application.";
        if (typeof showAlertModal === 'function') await showAlertModal(errorMsg);
        else alert(errorMsg);
        return;
    }

    try {
        let result = printerBackend.print_receipt(receiptText);
        if (result && typeof result.then === 'function') result = await result;

        const res = JSON.parse(result);
        if (!res.success) throw new Error(res.error);
        if (typeof showAlertModal === 'function') await showAlertModal("Receipt printed successfully!");
        else alert("Receipt printed successfully!");
    } catch (e) {
        console.error("[PRINT] Error:", e);
        const errorMsg = "Printer error: " + (e.message || String(e));
        if (typeof showAlertModal === 'function') await showAlertModal(errorMsg);
        else alert(errorMsg);
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
window.showConfirmModal = showConfirmModal;
window.showAlertModal = showAlertModal;
window.printOrderReceipt = printOrderReceipt;
window.printInvoice = printInvoice;
