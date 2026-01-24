// Print utility functions for receipts and invoices

// Print order receipt (when order is placed)
async function printOrderReceipt(orderId, dbBackend) {
    try {
        // Get order details
        const orderSql = `SELECT o.*, 
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
            FROM orders o WHERE o.id = ?`;
        const orders = await safeDbQuery(orderSql, [orderId], dbBackend);

        if (!orders || orders.length === 0) {
            alert("Order not found");
            return;
        }

        const order = orders[0];

        // Get order items
        const itemsSql = `
            SELECT oi.*, mi.name, mi.category 
            FROM order_items oi 
            JOIN menu_items mi ON oi.menu_item_id = mi.id 
            WHERE oi.order_id = ?
        `;
        const items = await safeDbQuery(itemsSql, [orderId], dbBackend);

        // Create receipt HTML
        const receiptHtml = generateReceiptHTML(order, items);

        // Show print popup
        showPrintPopup(receiptHtml, `Order_${orderId}_Receipt`);
    } catch (error) {
        console.error("Error printing receipt:", error);
        alert("Error generating receipt: " + error.message);
    }
}

// Print invoice (when order is marked complete)
async function printInvoice(orderId, dbBackend) {
    try {
        // Get order details
        const orderSql = `SELECT o.*, 
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
            FROM orders o WHERE o.id = ?`;
        const orders = await safeDbQuery(orderSql, [orderId], dbBackend);

        if (!orders || orders.length === 0) {
            alert("Order not found");
            return;
        }

        const order = orders[0];

        // Get order items
        const itemsSql = `
            SELECT oi.*, mi.name, mi.category 
            FROM order_items oi 
            JOIN menu_items mi ON oi.menu_item_id = mi.id 
            WHERE oi.order_id = ?
        `;
        const items = await safeDbQuery(itemsSql, [orderId], dbBackend);

        // Get payment transaction
        const paymentSql = `SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`;
        const payments = await safeDbQuery(paymentSql, [orderId], dbBackend);
        const payment = payments && payments.length > 0 ? payments[0] : null;

        // Create invoice HTML
        const invoiceHtml = generateInvoiceHTML(order, items, payment);

        // Show print popup
        showPrintPopup(invoiceHtml, `Order_${orderId}_Invoice`);
    } catch (error) {
        console.error("Error printing invoice:", error);
        alert("Error generating invoice: " + error.message);
    }
}

// Helper function for database queries
async function safeDbQuery(sql, params, dbBackend) {
    if (!dbBackend) {
        throw new Error("Database backend not initialized");
    }

    try {
        let response;
        if (params && params.length > 0) {
            const paramsJson = JSON.stringify(params);
            response = dbBackend.execute_with_params(sql, paramsJson);
        } else {
            response = dbBackend.execute_query(sql);
        }

        if (response && typeof response.then === 'function') {
            response = await response;
        }

        if (typeof response !== 'string') {
            throw new Error("Invalid response type from database");
        }

        const result = JSON.parse(response || "[]");
        return Array.isArray(result) ? result : [];
    } catch (error) {
        console.error("Database query error:", error);
        throw error;
    }
}

// Generate receipt HTML
function generateReceiptHTML(order, items) {
    const date = new Date(order.created_at).toLocaleString();
    const customerInfo = order.order_type === 'Table'
        ? `<p><strong>Table:</strong> ${order.table_number || 'N/A'}</p>`
        : `<p><strong>Customer:</strong> ${order.customer_name || 'N/A'}</p>`;

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order Receipt #${order.id}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
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
                <h1>Crave Hub</h1>
                <h2>Order Receipt</h2>
            </div>
            <div class="info">
                <p><strong>Order #:</strong> ${order.id}</p>
                <p><strong>Type:</strong> ${order.order_type}</p>
                ${customerInfo}
                <p><strong>Date:</strong> ${date}</p>
                <p><strong>Status:</strong> ${order.order_status || 'Pending'}</p>
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
                <p>Thank you for your order!</p>
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
        </body>
        </html>
    `;
}

// Generate invoice HTML
function generateInvoiceHTML(order, items, payment) {
    const date = new Date(order.created_at).toLocaleString();
    const paymentDate = payment ? new Date(payment.created_at).toLocaleString() : date;
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
                .payment { margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc; }
                .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
                .status { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 12px; }
                .status-completed { background-color: #4caf50; color: white; }
                .status-pending { background-color: #ff9800; color: white; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Crave Hub</h1>
                <h2>Invoice</h2>
            </div>
            <div class="info">
                <p><strong>Invoice #:</strong> ${order.id}</p>
                <p><strong>Order Type:</strong> ${order.order_type}</p>
                ${customerInfo}
                <p><strong>Order Date:</strong> ${date}</p>
                <p><strong>Order Status:</strong> <span class="status status-${order.order_status || 'pending'}">${(order.order_status || 'pending').toUpperCase()}</span></p>
                <p><strong>Payment Status:</strong> <span class="status status-${order.payment_status || 'pending'}">${(order.payment_status || 'pending').toUpperCase()}</span></p>
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
            ${payment ? `
            <div class="payment">
                <p><strong>Payment Method:</strong> ${payment.payment_method || 'Cash'}</p>
                <p><strong>Amount Paid:</strong> Rs. ${parseFloat(payment.amount).toFixed(2)}</p>
                <p><strong>Payment Date:</strong> ${paymentDate}</p>
            </div>
            ` : ''}
            <div class="footer">
                <p>Thank you for your business!</p>
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
        </body>
        </html>
    `;
}

// Show print popup
function showPrintPopup(htmlContent, title) {
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=600,height=800');

    if (!printWindow) {
        alert("Please allow popups to print receipts/invoices");
        return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load, then show print dialog
    printWindow.onload = function () {
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };
}

// Make functions globally accessible
window.printOrderReceipt = printOrderReceipt;
window.printInvoice = printInvoice;
