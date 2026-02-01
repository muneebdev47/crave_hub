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
    const CENTER = ESC + '\x61\x01';  // ESC a 1 - Center alignment
    const LEFT = ESC + '\x61\x00';    // ESC a 0 - Left alignment
    const RIGHT = ESC + '\x61\x02';   // ESC a 2 - Right alignment
    
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
    
    // Header - centered (no space on top)
    lines.push(CENTER + BOLD_ON + "                  CRAVEHUB CAFE" + BOLD_OFF + LEFT);
    lines.push(CENTER + "          Interloop Apparel # 2 Hostels" + LEFT);
    lines.push(CENTER + BOLD_ON + "                 +92 304 04 65 000" + BOLD_OFF + LEFT);
    lines.push("");
    
    // Order Information Section - right aligned, bold headings only
    lines.push(RIGHT + bold("Order No:") + "        " + orderNo + LEFT);
    const orderTypeLabel = order.order_type === 'Table' ? 'Table Order' : (order.order_type === 'Delivery' ? 'Delivery Order' : 'Takeaway Order');
    lines.push(RIGHT + bold("Order Type:") + "      " + orderTypeLabel + LEFT);
    lines.push(RIGHT + bold("Order Date:") + "      " + orderDate + LEFT);
    lines.push(RIGHT + bold("Print Time:") + "      " + printDateTime + LEFT);
    lines.push("");
    
    // Customer information - right aligned, bold headings only
    if (order.customer_name) {
        lines.push(RIGHT + bold("Customer:") + "        " + order.customer_name + LEFT);
    }
    
    if (order.customer_phone) {
        lines.push(RIGHT + bold("Phone:") + "           " + order.customer_phone + LEFT);
    }
    
    if (order.table_number != null && order.table_number !== undefined) {
        lines.push(RIGHT + bold("Table:") + "           " + order.table_number + LEFT);
    }
    
    // Address - only for delivery orders
    if (order.order_type === 'Delivery' && order.customer_address) {
        lines.push(RIGHT + bold("Address:") + "         " + order.customer_address + LEFT);
    }
    lines.push(RIGHT + bold("Order Due Date:") + "  " + orderDate + LEFT);
    lines.push("");
    
    // Items Table Header - bold header row
    // Fixed column widths: Sr(3) + 7sp, Product(19), Qty(3) + 3sp, Price(5) + 2sp, Total
    lines.push(bold("Sr.       Product            Qty   Price   Total"));
    lines.push("------------------------------------------------");
    
    // Calculate totals
    let subtotal = 0;
    let totalQty = 0;
    const discountPercent = order.discount_percentage || 0;
    
    // Items - fixed width columns to maintain alignment; expand deal components on receipt
    let sr = 0;
    items.forEach((item) => {
        sr += 1;
        const srNo = String(sr).padStart(2).padEnd(10);
        const productName = item.name.length > 19 ? item.name.substring(0, 16) + '...' : item.name;
        const product = productName.padEnd(19);
        const qty = String(item.quantity).padStart(3).padEnd(6);
        const price = String(parseFloat(item.price).toFixed(0)).padStart(5).padEnd(7);
        const itemTotal = (item.price * item.quantity);
        const amount = String(itemTotal.toFixed(0)).padStart(6);

        subtotal += itemTotal;
        totalQty += item.quantity;

        lines.push(`${srNo}${product}${qty}${price}${amount}`);

        // If this is a deal, show included items underneath (indented)
        if (item.deal_components && item.deal_components.length > 0) {
            item.deal_components.forEach(comp => {
                const compQty = (comp.quantity || 1) * item.quantity;
                const compName = ("   " + (comp.name || "Item")).substring(0, 19);
                const compNamePadded = compName.padEnd(19);
                const compQtyStr = String(compQty).padStart(3).padEnd(6);
                lines.push(`          ${compNamePadded}${compQtyStr}`);
            });
        }
    });
    
    lines.push("------------------------------------------------");
    
    // Summary Section - bold headings only
    const discountAmount = (subtotal * discountPercent) / 100;
    const netAmount = subtotal - discountAmount;
    const amountReceived = order.amount_received != null && !isNaN(parseFloat(order.amount_received)) ? parseFloat(order.amount_received) : null;
    const balanceReturn = order.balance_return != null && !isNaN(parseFloat(order.balance_return)) ? parseFloat(order.balance_return) : null;

    // Summary Section - right aligned, bold headings only
    lines.push(RIGHT + bold("No of Pieces:") + "     " + totalQty + LEFT);
    lines.push(RIGHT + bold("Gross Amount:") + "     " + subtotal.toFixed(0) + LEFT);
    lines.push(RIGHT + bold("Discount:") + "         " + discountAmount.toFixed(0) + LEFT);
    lines.push(RIGHT + bold("Net Amount:") + "       " + netAmount.toFixed(0) + LEFT);
    if (amountReceived != null) {
        const returnAmt = balanceReturn != null ? balanceReturn : Math.max(0, amountReceived - netAmount);
        lines.push(RIGHT + bold("Given:") + "            " + amountReceived.toFixed(0) + LEFT);
        lines.push(RIGHT + bold("Return:") + "           " + (returnAmt >= 0 ? returnAmt.toFixed(0) : "0") + LEFT);
        if (balanceReturn != null && balanceReturn < 0) {
            lines.push(RIGHT + bold("Short:") + "            " + Math.abs(balanceReturn).toFixed(0) + LEFT);
        }
    } else {
        const paid = order.payment_status === 'paid' ? netAmount : 0;
        const balance = netAmount - paid;
        lines.push(RIGHT + bold("Paid:") + "             " + paid.toFixed(0) + LEFT);
        lines.push(RIGHT + bold("Balance:") + "          " + balance.toFixed(0) + LEFT);
    }
    lines.push("");
    
    // Notes Section - bold heading only
    lines.push(bold("Order Note:"));
    if (order.order_note && order.order_note.trim()) {
        // Split note into lines if it's long
        const noteLines = order.order_note.split('\n');
        noteLines.forEach(line => {
            lines.push(line.trim());
        });
    } else {
        lines.push("");
    }
    lines.push("");
    lines.push(bold("Note:"));
    lines.push("Thank you for choosing us. Please come again.");
    lines.push("");
    lines.push("");
    
    // Payment Details - bold headings only
    lines.push(bold("Bank:") + "             Meezan Bank");
    lines.push(bold("Name:") + "             Awais Amjad");
    lines.push(bold("Account Number:") + "   2647 0113908048");
    lines.push(bold("IBAN:") + "             PK72 MEZN 0026 4701 1390 8048");
    lines.push(bold("JazzCash:") + "         0301 04 65 000");
    lines.push("");
    lines.push("");
    lines.push("------------------------------------------------");
    lines.push("Developed by:  engineermuneeb07@gmail.com");
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
        SELECT oi.quantity, oi.price, oi.menu_item_id, mi.name, COALESCE(mi.is_deal, 0) as is_deal
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
    `;
    const rawItems = await safeDbQuery(itemsSql, [orderId]);

    // Expand deals: for each deal item, fetch its components from deal_items
    const items = [];
    for (const row of rawItems) {
        const item = {
            name: row.name,
            quantity: row.quantity,
            price: row.price,
            menu_item_id: row.menu_item_id,
            is_deal: row.is_deal === 1 || row.is_deal === true
        };
        if (item.is_deal) {
            const dealItemsSql = `
                SELECT di.quantity, COALESCE(di.item_name, mi.name) as name
                FROM deal_items di
                LEFT JOIN menu_items mi ON mi.id = di.menu_item_id
                WHERE di.deal_id = ?
                ORDER BY di.id
            `;
            const components = await safeDbQuery(dealItemsSql, [row.menu_item_id]);
            item.deal_components = (components || []).map(c => ({ name: c.name, quantity: c.quantity }));
        }
        items.push(item);
    }

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
