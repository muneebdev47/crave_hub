// Initialize WebChannel and expose backends globally
// This runs automatically when the script loads
// Only ONE WebChannel initialization should exist in the entire app
(function initWebChannel() {
    if (typeof QWebChannel === 'undefined') {
        // Wait for QWebChannel to load
        setTimeout(initWebChannel, 100);
        return;
    }

    if (typeof qt === 'undefined' || !qt.webChannelTransport) {
        console.warn("[WebChannel] Qt WebChannel not available, retrying...");
        setTimeout(initWebChannel, 500);
        return;
    }

    // Prevent multiple initializations
    if (window._webChannelInitialized) {
        console.log("[WebChannel] Already initialized, skipping...");
        return;
    }

    try {
        console.log("[WebChannel] Initializing...");
        new QWebChannel(qt.webChannelTransport, function (channel) {
            if (!channel || !channel.objects) {
                console.error("[WebChannel] Invalid channel or objects");
                return;
            }

            // Assign to window (global scope)
            window.menuBackend = channel.objects.menuBackend;
            window.dbBackend = channel.objects.dbBackend;
            window.printerBackend = channel.objects.printerBackend;

            // Also assign to global variables for backward compatibility (only if not already declared)
            if (typeof menuBackend === 'undefined') {
                menuBackend = channel.objects.menuBackend;
            }
            if (typeof dbBackend === 'undefined') {
                dbBackend = channel.objects.dbBackend;
            }
            if (typeof printerBackend === 'undefined') {
                printerBackend = channel.objects.printerBackend;
            }

            // Mark as initialized
            window._webChannelInitialized = true;

            console.log("[WebChannel] Initialized successfully");
            console.log("[WebChannel] Available backends:", {
                menuBackend: !!window.menuBackend,
                dbBackend: !!window.dbBackend,
                printerBackend: !!window.printerBackend
            });

            // Dispatch custom event to notify other scripts
            window.dispatchEvent(new CustomEvent('webchannel-ready', {
                detail: {
                    menuBackend: window.menuBackend,
                    dbBackend: window.dbBackend,
                    printerBackend: window.printerBackend
                }
            }));
        });
    } catch (error) {
        console.error("[WebChannel] Error initializing:", error);
        console.error("[WebChannel] Stack:", error.stack);
    }
})();
