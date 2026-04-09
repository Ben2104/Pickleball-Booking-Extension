(function () {
    const BRIDGE_KEY = "__pickleballBookingAlertBridge";
    const ALERT_ARMED_ATTR = "data-pickleball-booking-alert-armed";
    const ALERT_SEEN_ATTR = "data-pickleball-booking-alert-seen";
    const ALERT_MESSAGE_ATTR = "data-pickleball-booking-alert-message";
    const root = document.documentElement;

    if (!root) {
        return;
    }

    if (window[BRIDGE_KEY]?.installed) {
        return;
    }

    const originalAlert = typeof window.alert === "function" ? window.alert.bind(window) : null;
    window[BRIDGE_KEY] = {
        installed: true,
        originalAlert,
    };

    window.alert = message => {
        if (root.getAttribute(ALERT_ARMED_ATTR) === "true") {
            root.setAttribute(ALERT_SEEN_ATTR, "true");
            root.setAttribute(ALERT_MESSAGE_ATTR, String(message || ""));
            return;
        }

        if (typeof originalAlert === "function") {
            return originalAlert(message);
        }
    };
})();
