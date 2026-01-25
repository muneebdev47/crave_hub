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

    if (!window.printerBackend) {
        if (typeof showAlertModal === 'function') await showAlertModal("Printer backend not available. Restart app.");
        else alert("Printer backend not available. Restart app.");
        return;
    }

    let result = window.printerBackend.print_receipt(receiptText);
    if (result && typeof result.then === 'function') result = await result;

    try {
        const res = JSON.parse(result);
        if (!res.success) throw new Error(res.error);
        if (typeof showAlertModal === 'function') await showAlertModal("Receipt printed successfully!");
        else alert("Receipt printed successfully!");
    } catch (e) {
        if (typeof showAlertModal === 'function') await showAlertModal("Printer error: " + e.message);
        else alert("Printer error: " + e.message);
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
