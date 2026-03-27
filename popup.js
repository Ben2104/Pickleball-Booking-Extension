const DEFAULT_STATUS = "Open the page panel to enter a booking range and schedule settings.";

function setStatus(message, tone = "neutral") {
    const status = document.getElementById("status");
    if (!status) {
        return;
    }

    status.textContent = message;
    status.dataset.tone = tone;
}

async function getActiveTabId() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length || typeof tabs[0].id !== "number") {
        throw new Error("No active tab was found.");
    }

    return tabs[0].id;
}

async function runAction(action) {
    setStatus("Injecting booking assistant...", "neutral");

    try {
        const tabId = await getActiveTabId();

        await chrome.scripting.executeScript({
            target: { tabId },
            files: ["booking-functions.js"],
        });

        await chrome.scripting.executeScript({
            target: { tabId },
            func: currentAction => {
                if (!window.PickleballBooking || typeof window.PickleballBooking.handleAction !== "function") {
                    throw new Error("Booking assistant was not initialized.");
                }

                window.PickleballBooking.handleAction(currentAction);
            },
            args: [action],
        });

        const statusMessage = action === "schedule"
            ? "Booking scheduled on the page."
            : "Booking panel opened on the page.";
        setStatus(statusMessage, "success");
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Unable to start the booking assistant.", "error");
    }
}

document.getElementById("startNow").addEventListener("click", () => {
    runAction("start");
});

document.getElementById("scheduleBooking").addEventListener("click", () => {
    runAction("schedule");
});

document.getElementById("openPanel").addEventListener("click", () => {
    runAction("panel");
});

setStatus(DEFAULT_STATUS);
