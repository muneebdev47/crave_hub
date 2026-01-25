// Database utility functions
async function safeDbQuery(sql, params, dbBackend) {
    // Use global dbBackend if not provided
    const backend = dbBackend || window.dbBackend;
    
    if (!backend) {
        console.error("[DB] Database backend not available");
        throw new Error("Database backend not initialized");
    }

    try {
        let response;
        
        if (params && Array.isArray(params) && params.length > 0) {
            // Use parameterized query
            const paramsJson = JSON.stringify(params);
            response = backend.execute_with_params(sql, paramsJson);
        } else {
            // Use direct query
            response = backend.execute_query(sql);
        }

        // Handle Promise if returned
        if (response && typeof response.then === 'function') {
            response = await response;
        }

        // Check if response is a string
        if (typeof response !== 'string') {
            console.error("[DB] Invalid response type:", typeof response, response);
            return [];
        }

        // Parse JSON
        const result = JSON.parse(response || "[]");
        return Array.isArray(result) ? result : [];
    } catch (error) {
        console.error("[DB] Database query error:", error);
        console.error("[DB] SQL:", sql);
        console.error("[DB] Params:", params);
        throw error;
    }
}

// Make function globally accessible
window.safeDbQuery = safeDbQuery;
