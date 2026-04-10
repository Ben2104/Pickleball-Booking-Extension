(function () {
    if (window.PickleballBooking) {
        return;
    }

    const COURT_PRIORITY_STORAGE_KEY = "courtPriorityOrder";

    const CONFIG = {
        desiredTimes: ["5:30-6:30pm", "6:30-7:00pm", "7:00-7:30pm", "7:30-8:00pm"], 
        targetHour: 7,
        targetMinute: 0,
        countdownMessageXPath: "//div[contains(text(),'Booking for this day will open in')]",
        countdownHourXPath: "(//div[contains(@class,'Countdown')]//td)[1]",
        countdownMinuteXPath: "(//div[contains(@class,'Countdown')]//td)[3]",
        countdownSecondXPath: "(//div[contains(@class,'Countdown')]//td)[5]",
        countdownInitialDelayMs: 1000,
        countdownPollMs: 200,
        timeSlotAlertWindowMs: 35,
        timeSlotAlertPollMs: 5,
        timeSlotSettlePollMs: 40,
        timeSlotSettleTimeoutMs: 2000,
        timeSlotInterClickDelayMs: 0,
        courtSelectionPollMs: 120,
        courtSelectionTimeoutMs: 2000,
        bookingResultPollMs: 150,
        bookingResultTimeoutMs: 4000,
        actionDelayMs: 250,
        MAX_BOOKING_ATTEMPTS: 3,
        courtPriority: [
            "PICKLEBALL 4",
            "PICKLEBALL 2",
            "PICKLEBALL 1",
            "PICKLEBALL 6",
            "PICKLEBALL 3",
            "PICKLEBALL 9",
            "PICKLEBALL 7",
            "PICKLEBALL 8",
            "PICKLEBALL 5",
            "PICKLEBALL 10",
        ],
    };

    const state = {
        scheduledTimer: null,
        runPromise: null,
        waitCancelled: false,
        desiredTimeIndex: 0,
        bookingAttempts: 0,
        desiredTimes: [...CONFIG.desiredTimes],
        desiredRangeStartInput: null,
        desiredRangeEndInput: null,
        desiredRangeMeridiemSelect: null,
        desiredTimesPreview: null,
        scheduleHour: CONFIG.targetHour,
        scheduleMinute: CONFIG.targetMinute,
        scheduleHourInput: null,
        scheduleMinuteInput: null,
        panel: null,
        statusText: null,
        modeText: null,
        countdownText: null,
        countdownLabel: null,
        courtPriority: [...CONFIG.courtPriority],
        courtPriorityList: null,
        courtPriorityPreview: null,
        draggedCourtName: null,
        courtPriorityReady: null,
        triedCourts: [],
        currentCourtName: null,
    };

    state.courtPriorityReady = initializeCourtPriority();

    function wait(ms) {
        return new Promise(resolve => {
            window.setTimeout(resolve, ms);
        });
    }

    function evaluateXPath(xpath, resultType) {
        return document.evaluate(xpath, document, null, resultType, null);
    }

    function getXPathNode(xpath) {
        return evaluateXPath(xpath, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue;
    }

    function getXPathCount(xpath) {
        return evaluateXPath(xpath, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE).snapshotLength;
    }

    function getXPathText(xpath) {
        const node = getXPathNode(xpath);
        return node && node.textContent ? node.textContent.trim() : "";
    }

    function createElement(tagName, className, textContent) {
        const element = document.createElement(tagName);
        if (className) {
            element.className = className;
        }
        if (typeof textContent === "string") {
            element.textContent = textContent;
        }
        return element;
    }

    function applyButtonStyle(button, tone) {
        const tones = {
            primary: {
                background: "linear-gradient(135deg, #0f766e, #115e59)",
                color: "#ffffff",
                boxShadow: "0 12px 22px rgba(15, 118, 110, 0.22)",
            },
            secondary: {
                background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                color: "#1d4ed8",
                boxShadow: "none",
            },
            danger: {
                background: "linear-gradient(135deg, #fca5a5, #ef4444)",
                color: "#ffffff",
                boxShadow: "none",
            },
        };

        const selectedTone = tones[tone];
        Object.assign(button.style, {
            border: "0",
            borderRadius: "14px",
            padding: "12px 14px",
            fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer",
            transition: "transform 120ms ease, opacity 120ms ease",
            ...selectedTone,
        });

        button.addEventListener("mouseenter", () => {
            button.style.transform = "translateY(-1px)";
        });

        button.addEventListener("mouseleave", () => {
            button.style.transform = "translateY(0)";
        });
    }

    function getStorageArea() {
        if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
            return null;
        }

        return chrome.storage.local;
    }

    function readStorageValue(key) {
        const storage = getStorageArea();
        if (!storage) {
            return Promise.resolve(undefined);
        }

        return new Promise(resolve => {
            storage.get([key], result => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    console.warn(chrome.runtime.lastError.message);
                    resolve(undefined);
                    return;
                }

                resolve(result ? result[key] : undefined);
            });
        });
    }

    function writeStorageValue(key, value) {
        const storage = getStorageArea();
        if (!storage) {
            return Promise.resolve(false);
        }

        return new Promise(resolve => {
            storage.set({ [key]: value }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                    console.warn(chrome.runtime.lastError.message);
                    resolve(false);
                    return;
                }

                resolve(true);
            });
        });
    }

    function arraysEqual(left, right) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
            return false;
        }

        return left.every((value, index) => value === right[index]);
    }

    function normalizeCourtPriorityOrder(order) {
        const knownCourts = new Set(CONFIG.courtPriority);
        const normalized = [];

        if (Array.isArray(order)) {
            order.forEach(item => {
                const label = normalizeText(item).toUpperCase();
                if (!knownCourts.has(label) || normalized.includes(label)) {
                    return;
                }

                normalized.push(label);
            });
        }

        CONFIG.courtPriority.forEach(defaultCourt => {
            if (!normalized.includes(defaultCourt)) {
                normalized.push(defaultCourt);
            }
        });

        return normalized;
    }

    function serializeCourtPriority(order = state.courtPriority) {
        return order.join(", ");
    }

    function getRemainingCourtPriority() {
        return state.courtPriority.filter(courtName => !state.triedCourts.includes(courtName));
    }

    async function persistCourtPriorityOrder(order = state.courtPriority) {
        const normalizedOrder = normalizeCourtPriorityOrder(order);
        state.courtPriority = normalizedOrder;
        return writeStorageValue(COURT_PRIORITY_STORAGE_KEY, normalizedOrder);
    }

    async function initializeCourtPriority() {
        const storedOrder = await readStorageValue(COURT_PRIORITY_STORAGE_KEY);
        const normalizedOrder = normalizeCourtPriorityOrder(storedOrder);
        state.courtPriority = normalizedOrder;

        if (!arraysEqual(storedOrder, normalizedOrder)) {
            await persistCourtPriorityOrder(normalizedOrder);
        }

        renderCourtPriorityList();
        updateCourtPriorityPreview();
        return normalizedOrder;
    }

    function updateCourtPriorityPreview(tone = "neutral") {
        if (!state.courtPriorityPreview) {
            return;
        }

        state.courtPriorityPreview.textContent = serializeCourtPriority();
        const colors = {
            neutral: "#183454",
            success: "#166534",
            warning: "#b45309",
            error: "#b91c1c",
        };
        state.courtPriorityPreview.style.color = colors[tone];
    }

    function clearCourtPriorityDropIndicators() {
        if (!state.courtPriorityList) {
            return;
        }

        Array.from(state.courtPriorityList.children).forEach(row => {
            row.style.borderTopColor = row.dataset.index === "0" ? "transparent" : "rgba(24, 52, 84, 0.08)";
            row.style.borderBottomColor = "transparent";
            row.style.background = "rgba(255, 255, 255, 0.94)";
        });
    }

    function getCourtPriorityDropPosition(event, row) {
        const bounds = row.getBoundingClientRect();
        const midpoint = bounds.top + bounds.height / 2;
        return event.clientY < midpoint ? "before" : "after";
    }

    function styleCourtPriorityDropTarget(row, position) {
        clearCourtPriorityDropIndicators();
        row.style.background = "rgba(239, 246, 255, 0.98)";
        if (position === "before") {
            row.style.borderTopColor = "#1d4ed8";
        } else {
            row.style.borderBottomColor = "#1d4ed8";
        }
    }

    async function moveCourtPriority(draggedCourtName, targetCourtName, position) {
        const nextOrder = [...state.courtPriority];
        const currentIndex = nextOrder.indexOf(draggedCourtName);
        const targetIndex = nextOrder.indexOf(targetCourtName);

        if (currentIndex === -1 || targetIndex === -1) {
            clearCourtPriorityDropIndicators();
            renderCourtPriorityList();
            return;
        }

        nextOrder.splice(currentIndex, 1);

        let insertionIndex = targetIndex;
        if (currentIndex < targetIndex) {
            insertionIndex -= 1;
        }
        if (position === "after") {
            insertionIndex += 1;
        }

        nextOrder.splice(insertionIndex, 0, draggedCourtName);

        state.courtPriority = nextOrder;
        state.draggedCourtName = null;
        clearCourtPriorityDropIndicators();
        renderCourtPriorityList();
        updateCourtPriorityPreview("success");
        await persistCourtPriorityOrder(nextOrder);
        setStatus(`Court priority saved. ${draggedCourtName} is now #${nextOrder.indexOf(draggedCourtName) + 1}.`, "success");
    }

    function createCourtPriorityRow(courtName, index) {
        const row = createElement("div");
        row.draggable = true;
        row.dataset.courtName = courtName;
        row.dataset.index = String(index);
        Object.assign(row.style, {
            display: "grid",
            gridTemplateColumns: "34px 1fr auto",
            gap: "10px",
            alignItems: "center",
            padding: "12px 14px",
            background: "rgba(255, 255, 255, 0.94)",
            cursor: "grab",
            userSelect: "none",
            borderTop: index === 0 ? "1px solid transparent" : "1px solid rgba(24, 52, 84, 0.08)",
            borderBottom: "1px solid transparent",
            transition: "background 120ms ease, border-color 120ms ease, transform 120ms ease",
        });

        const rank = createElement("div", null, String(index + 1));
        Object.assign(rank.style, {
            width: "28px",
            height: "28px",
            display: "grid",
            placeItems: "center",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: "700",
            color: "#1d4ed8",
            background: "rgba(219, 234, 254, 0.9)",
        });

        const name = createElement("div", null, courtName);
        Object.assign(name.style, {
            fontSize: "13px",
            fontWeight: "700",
            letterSpacing: "0.02em",
            color: "#183454",
        });

        const handle = createElement("div", null, "drag");
        Object.assign(handle.style, {
            fontSize: "10px",
            fontWeight: "700",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#5d7085",
        });

        row.addEventListener("dragstart", event => {
            state.draggedCourtName = courtName;
            row.style.opacity = "0.55";
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", courtName);
            }
        });

        row.addEventListener("dragend", () => {
            state.draggedCourtName = null;
            row.style.opacity = "1";
            clearCourtPriorityDropIndicators();
            renderCourtPriorityList();
        });

        row.addEventListener("dragover", event => {
            if (!state.draggedCourtName || state.draggedCourtName === courtName) {
                return;
            }

            event.preventDefault();
            styleCourtPriorityDropTarget(row, getCourtPriorityDropPosition(event, row));
        });

        row.addEventListener("dragleave", event => {
            if (row.contains(event.relatedTarget)) {
                return;
            }

            clearCourtPriorityDropIndicators();
        });

        row.addEventListener("drop", async event => {
            event.preventDefault();
            if (!state.draggedCourtName || state.draggedCourtName === courtName) {
                clearCourtPriorityDropIndicators();
                return;
            }

            const position = getCourtPriorityDropPosition(event, row);
            await moveCourtPriority(state.draggedCourtName, courtName, position);
        });

        row.append(rank, name, handle);
        return row;
    }

    function renderCourtPriorityList() {
        if (!state.courtPriorityList) {
            return;
        }

        state.courtPriorityList.replaceChildren(
            ...state.courtPriority.map((courtName, index) => createCourtPriorityRow(courtName, index))
        );
    }

    function ensurePanel() {
        if (state.panel && document.body.contains(state.panel)) {
            return;
        }

        const existing = document.getElementById("pickleball-booking-panel");
        if (existing) {
            existing.remove();
        }

        const panel = createElement("section");
        panel.id = "pickleball-booking-panel";
        Object.assign(panel.style, {
            position: "fixed",
            right: "20px",
            bottom: "20px",
            width: "340px",
            zIndex: "2147483647",
            borderRadius: "22px",
            overflow: "hidden",
            color: "#183454",
            fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
            background: "linear-gradient(155deg, rgba(245, 248, 255, 0.96), rgba(237, 247, 239, 0.96))",
            border: "1px solid rgba(24, 52, 84, 0.12)",
            boxShadow: "0 24px 48px rgba(24, 52, 84, 0.22)",
            backdropFilter: "blur(10px)",
        });

        const header = createElement("div");
        Object.assign(header.style, {
            padding: "18px 18px 14px",
            borderBottom: "1px solid rgba(24, 52, 84, 0.08)",
            background: "linear-gradient(135deg, rgba(15, 118, 110, 0.12), rgba(29, 78, 216, 0.12))",
        });

        const eyebrow = createElement("div", null, "Pickleball Booker");
        Object.assign(eyebrow.style, {
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 10px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#1d4ed8",
            background: "rgba(219, 234, 254, 0.9)",
        });

        const title = createElement("h3", null, "Countdown-aware booking");
        Object.assign(title.style, {
            margin: "14px 0 8px",
            fontSize: "20px",
            lineHeight: "1.1",
        });

        const intro = createElement("p", null, "The assistant waits for the site countdown when it is visible, then runs the booking flow.");
        Object.assign(intro.style, {
            margin: "0",
            color: "#5d7085",
            fontSize: "13px",
            lineHeight: "1.5",
        });

        header.append(eyebrow, title, intro);

        const body = createElement("div");
        Object.assign(body.style, {
            padding: "16px 18px 18px",
            display: "grid",
            gap: "12px",
        });

        const courtPrioritySection = createElement("div");
        Object.assign(courtPrioritySection.style, {
            display: "grid",
            gap: "8px",
        });

        const courtPriorityHeader = createElement("div");
        Object.assign(courtPriorityHeader.style, {
            display: "grid",
            gap: "4px",
        });

        const courtPriorityLabel = createElement("div", null, "Court Priority");
        Object.assign(courtPriorityLabel.style, {
            fontSize: "11px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#5d7085",
        });

        const courtPriorityHelp = createElement("p", null, "Drag courts into order. Top is highest priority for Start Now and Schedule Booking.");
        Object.assign(courtPriorityHelp.style, {
            margin: "0",
            color: "#5d7085",
            fontSize: "12px",
            lineHeight: "1.45",
        });

        courtPriorityHeader.append(courtPriorityLabel, courtPriorityHelp);

        const courtPriorityBox = createElement("div");
        Object.assign(courtPriorityBox.style, {
            maxHeight: "246px",
            overflowY: "auto",
            border: "1px solid rgba(24, 52, 84, 0.12)",
            borderRadius: "16px",
            background: "rgba(255, 255, 255, 0.82)",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.7)",
        });

        const courtPriorityList = createElement("div");
        Object.assign(courtPriorityList.style, {
            display: "grid",
        });

        courtPriorityBox.appendChild(courtPriorityList);

        const courtPriorityPreview = createPreviewCard(
            "Priority String",
            serializeCourtPriority(),
            { minHeight: "52px", fontSize: "12px" }
        );

        courtPrioritySection.append(
            courtPriorityHeader,
            courtPriorityBox,
            courtPriorityPreview.wrapper
        );

        const desiredRangeFields = createElement("div");
        Object.assign(desiredRangeFields.style, {
            display: "grid",
            gridTemplateColumns: "1fr 1fr 96px",
            gap: "10px",
        });

        const desiredStartField = createPanelInput("Start", "7");
        const desiredEndField = createPanelInput("End", "9");
        const meridiemField = createPanelSelect("AM or PM", ["AM", "PM"]);
        desiredStartField.input.value = "7";
        desiredEndField.input.value = "9";
        meridiemField.select.value = "AM";
        desiredStartField.input.addEventListener("input", () => {
            syncDesiredTimesFromInput();
        });
        desiredEndField.input.addEventListener("input", () => {
            syncDesiredTimesFromInput();
        });
        meridiemField.select.addEventListener("change", () => {
            syncDesiredTimesFromInput();
        });
        desiredRangeFields.append(
            desiredStartField.wrapper,
            desiredEndField.wrapper,
            meridiemField.wrapper
        );

        const desiredTimesPreview = createPreviewCard("Generated Slots", state.desiredTimes.join(", "));

        const statusCard = createElement("div");
        Object.assign(statusCard.style, {
            padding: "14px",
            borderRadius: "16px",
            background: "rgba(255, 255, 255, 0.78)",
            border: "1px solid rgba(24, 52, 84, 0.08)",
            display: "grid",
            gap: "10px",
        });

        const modeRow = createLabelValueRow("Mode", "Idle");
        const countdownRow = createLabelValueRow("Countdown", "Not started");
        const statusRow = createLabelValueRow("Status", "Assistant ready.");
        statusCard.append(modeRow.row, countdownRow.row, statusRow.row);

        const buttonGrid = createElement("div");
        Object.assign(buttonGrid.style, {
            display: "grid",
            gap: "10px",
        });

        const startButton = createElement("button", null, "Start Now");
        applyButtonStyle(startButton, "primary");
        startButton.addEventListener("click", () => {
            api.startImmediate();
        });

        const scheduleButton = createElement("button", null, "Schedule Booking");
        applyButtonStyle(scheduleButton, "secondary");
        scheduleButton.addEventListener("click", () => {
            api.scheduleBooking();
        });

        const cancelButton = createElement("button", null, "Cancel Wait or Schedule");
        applyButtonStyle(cancelButton, "danger");
        cancelButton.addEventListener("click", () => {
            api.cancelPendingWork();
        });

        buttonGrid.append(startButton, scheduleButton, cancelButton);
        body.append(
            courtPrioritySection,
            desiredRangeFields,
            desiredTimesPreview.wrapper,
            statusCard,
            buttonGrid
        );
        panel.append(header, body);
        document.body.appendChild(panel);

        state.panel = panel;
        state.courtPriorityList = courtPriorityList;
        state.courtPriorityPreview = courtPriorityPreview.value;
        state.desiredRangeStartInput = desiredStartField.input;
        state.desiredRangeEndInput = desiredEndField.input;
        state.desiredRangeMeridiemSelect = meridiemField.select;
        state.desiredTimesPreview = desiredTimesPreview.value;
        state.modeText = modeRow.value;
        state.countdownText = countdownRow.value;
        state.statusText = statusRow.value;
        state.countdownLabel = countdownRow.row;
        renderCourtPriorityList();
        updateCourtPriorityPreview();
        updateDesiredTimesPreview();
    }

    function createPanelSelect(label, options) {
        const wrapper = createElement("label");
        Object.assign(wrapper.style, {
            display: "grid",
            gap: "6px",
        });

        const labelElement = createElement("div", null, label);
        Object.assign(labelElement.style, {
            fontSize: "11px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#5d7085",
        });

        const select = document.createElement("select");
        Object.assign(select.style, {
            width: "100%",
            border: "1px solid rgba(24, 52, 84, 0.12)",
            borderRadius: "12px",
            padding: "11px 12px",
            fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
            fontSize: "14px",
            color: "#183454",
            background: "#ffffff",
            appearance: "none",
        });

        options.forEach(optionValue => {
            const option = document.createElement("option");
            option.value = optionValue;
            option.textContent = optionValue;
            select.appendChild(option);
        });

        wrapper.append(labelElement, select);
        return { wrapper, select };
    }

    function createPanelInput(label, placeholder) {
        const wrapper = createElement("label");
        Object.assign(wrapper.style, {
            display: "grid",
            gap: "6px",
        });

        const labelElement = createElement("div", null, label);
        Object.assign(labelElement.style, {
            fontSize: "11px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#5d7085",
        });

        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.placeholder = placeholder;
        Object.assign(input.style, {
            width: "100%",
            border: "1px solid rgba(24, 52, 84, 0.12)",
            borderRadius: "12px",
            padding: "11px 12px",
            fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
            fontSize: "14px",
            color: "#183454",
            background: "#ffffff",
        });

        wrapper.append(labelElement, input);
        return { wrapper, input };
    }

    function createPreviewCard(label, initialValue, options = {}) {
        const wrapper = createElement("div");
        Object.assign(wrapper.style, {
            display: "grid",
            gap: "6px",
        });

        const labelElement = createElement("div", null, label);
        Object.assign(labelElement.style, {
            fontSize: "11px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#5d7085",
        });

        const value = createElement("div", null, initialValue);
        Object.assign(value.style, {
            minHeight: options.minHeight || "62px",
            border: "1px solid rgba(24, 52, 84, 0.12)",
            borderRadius: "12px",
            padding: "11px 12px",
            background: "#ffffff",
            fontSize: options.fontSize || "13px",
            lineHeight: "1.5",
            color: "#183454",
            whiteSpace: options.whiteSpace || "normal",
            wordBreak: "break-word",
        });

        wrapper.append(labelElement, value);
        return { wrapper, value };
    }

    function createLabelValueRow(label, initialValue) {
        const row = createElement("div");
        Object.assign(row.style, {
            display: "grid",
            gap: "4px",
        });

        const labelElement = createElement("div", null, label);
        Object.assign(labelElement.style, {
            fontSize: "11px",
            fontWeight: "700",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#5d7085",
        });

        const value = createElement("div", null, initialValue);
        Object.assign(value.style, {
            fontSize: "14px",
            fontWeight: "700",
            color: "#183454",
            lineHeight: "1.4",
        });

        row.append(labelElement, value);
        return { row, value };
    }

    function setMode(message) {
        ensurePanel();
        state.modeText.textContent = message;
    }

    function setCountdown(message, tone = "neutral") {
        ensurePanel();
        state.countdownText.textContent = message;
        const colors = {
            neutral: "#183454",
            info: "#1d4ed8",
            success: "#166534",
            warning: "#b45309",
            error: "#b91c1c",
        };
        state.countdownText.style.color = colors[tone];
    }

    function setStatus(message, tone = "neutral") {
        ensurePanel();
        state.statusText.textContent = message;
        const styles = {
            neutral: { color: "#183454" },
            info: { color: "#1d4ed8" },
            success: { color: "#166534" },
            warning: { color: "#b45309" },
            error: { color: "#b91c1c" },
        };
        Object.assign(state.statusText.style, styles[tone]);
    }

    function formatTime12Hour(hour, minute) {
        const period = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 === 0 ? 12 : hour % 12;
        return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
    }

    function calculateDelayUntilTargetTime(hours, minutes) {
        const now = new Date();
        const targetTime = new Date(now);
        targetTime.setHours(hours, minutes, 0, 0);

        if (now > targetTime) {
            targetTime.setDate(targetTime.getDate() + 1);
        }

        return targetTime.getTime() - now.getTime();
    }

    function syncScheduleTimeFromInputs() {
        if (!state.scheduleHourInput || !state.scheduleMinuteInput) {
            if (Number.isInteger(state.scheduleHour) && Number.isInteger(state.scheduleMinute)) {
                return true;
            }

            state.scheduleHour = CONFIG.targetHour;
            state.scheduleMinute = CONFIG.targetMinute;
            return true;
        }

        const hourText = state.scheduleHourInput.value.trim();
        const minuteText = state.scheduleMinuteInput.value.trim();

        if (!hourText || !minuteText) {
            setStatus("Enter both hour and minutes before scheduling.", "error");
            return false;
        }

        const hour = Number.parseInt(hourText, 10);
        const minute = Number.parseInt(minuteText, 10);

        if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
            setStatus("Hour must be a number from 0 to 23.", "error");
            return false;
        }

        if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
            setStatus("Minutes must be a number from 0 to 59.", "error");
            return false;
        }

        state.scheduleHour = hour;
        state.scheduleMinute = minute;
        state.scheduleHourInput.value = String(hour);
        state.scheduleMinuteInput.value = String(minute).padStart(2, "0");
        return true;
    }

    function updateDesiredTimesPreview(message = null, tone = "neutral") {
        if (!state.desiredTimesPreview) {
            return;
        }

        state.desiredTimesPreview.textContent = message || state.desiredTimes.join(", ");
        const colors = {
            neutral: "#183454",
            success: "#166534",
            warning: "#b45309",
            error: "#b91c1c",
        };
        state.desiredTimesPreview.style.color = colors[tone];
    }

    function parseHalfHourTime(value) {
        const cleaned = String(value || "").trim();
        const match = cleaned.match(/^(\d{1,2})(?::(00|30))?$/);
        if (!match) {
            return null;
        }

        const hour = Number.parseInt(match[1], 10);
        const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
        if (hour < 1 || hour > 12) {
            return null;
        }

        return { hour, minute };
    }

    function convertToMinutesWithinPeriod(time) {
        const normalizedHour = time.hour % 12;
        return normalizedHour * 60 + time.minute;
    }

    function formatSlotBoundary(totalMinutes) {
        const hour24 = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        let hour12 = hour24 % 12;
        if (hour12 === 0) {
            hour12 = 12;
        }

        return minute === 0 ? String(hour12) : `${hour12}:${String(minute).padStart(2, "0")}`;
    }

    function generateDesiredTimeSlots(startInput, endInput, meridiem) {
        const start = parseHalfHourTime(startInput);
        const end = parseHalfHourTime(endInput);
        if (!start || !end) {
            return { error: "Use hour or half-hour values like 7 or 7:30." };
        }

        const startMinutes = convertToMinutesWithinPeriod(start);
        const endMinutes = convertToMinutesWithinPeriod(end);
        if (endMinutes <= startMinutes) {
            return { error: "End time must be later than start time." };
        }

        const slots = [];
        for (let cursor = startMinutes; cursor < endMinutes; cursor += 30) {
            const next = cursor + 30;
            if (next > endMinutes) {
                return { error: "Booking range must fit 30-minute increments." };
            }

            slots.push(`${formatSlotBoundary(cursor)}-${formatSlotBoundary(next)}${meridiem}`);
        }

        if (!slots.length) {
            return { error: "Enter a booking range that creates at least one 30-minute slot." };
        }

        return { slots };
    }

    function syncDesiredTimesFromInput() {
        if (!state.desiredRangeStartInput || !state.desiredRangeEndInput || !state.desiredRangeMeridiemSelect) {
            return true;
        }

        const result = generateDesiredTimeSlots(
            state.desiredRangeStartInput.value,
            state.desiredRangeEndInput.value,
            state.desiredRangeMeridiemSelect.value
        );
        if (result.error) {
            updateDesiredTimesPreview(result.error, "error");
            setStatus(result.error, "error");
            return false;
        }

        state.desiredTimes = result.slots;
        updateDesiredTimesPreview(result.slots.join(", "), "success");
        return true;
    }

    function isVisibleButton(button) {
        return !!button && !button.disabled && button.offsetParent !== null;
    }

    function normalizeText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
    }

    function parseTimePart(value) {
        const cleaned = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
        const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)?$/);
        if (!match) {
            return null;
        }

        return {
            hour: match[1],
            minute: match[2] || "00",
            meridiem: match[3] || "",
        };
    }

    function formatCanonicalTimePart(part) {
        if (!part) {
            return "";
        }

        return part.minute === "00" ? part.hour : `${part.hour}:${part.minute}`;
    }

    function canonicalizeTimeSlotLabel(value) {
        const cleaned = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
        if (!cleaned.includes("-")) {
            return cleaned;
        }

        const segments = cleaned.split("-");
        if (segments.length !== 2) {
            return cleaned;
        }

        const startPart = parseTimePart(segments[0]);
        const endPart = parseTimePart(segments[1]);
        if (!startPart || !endPart) {
            return cleaned;
        }

        const meridiem = endPart.meridiem || startPart.meridiem;
        return `${formatCanonicalTimePart(startPart)}-${formatCanonicalTimePart(endPart)}${meridiem}`;
    }

    function findButton(criteria, partialMatch = false) {
        const normalizedCriteria = criteria.trim().toUpperCase();
        return Array.from(document.querySelectorAll("button")).find(button => {
            if (!isVisibleButton(button)) {
                return false;
            }

            const text = button.textContent ? button.textContent.trim().toUpperCase() : "";
            return partialMatch ? text.includes(normalizedCriteria) : text === normalizedCriteria;
        }) || null;
    }

    function getButtonStateSignature(button) {
        if (!button) {
            return "missing";
        }

        return JSON.stringify({
            className: button.className || "",
            ariaPressed: button.getAttribute("aria-pressed") || "",
            ariaSelected: button.getAttribute("aria-selected") || "",
            disabled: button.disabled,
            dataState: button.getAttribute("data-state") || "",
            text: normalizeText(button.textContent),
        });
    }

    function getVisibleTimeSlotButtonsSnapshot() {
        return Array.from(document.querySelectorAll("button"))
            .filter(isVisibleButton)
            .map(button => canonicalizeTimeSlotLabel(button.textContent))
            .filter(Boolean)
            .join("|");
    }

    function findTimeSlotButton(label) {
        const buttons = Array.from(document.querySelectorAll("button")).filter(isVisibleButton);
        const normalizedLabel = canonicalizeTimeSlotLabel(label);

        let matchedButton = buttons.find(button => canonicalizeTimeSlotLabel(button.textContent) === normalizedLabel) || null;
        if (matchedButton) {
            return matchedButton;
        }

        matchedButton = buttons.find(button => canonicalizeTimeSlotLabel(button.textContent).includes(normalizedLabel)) || null;
        if (matchedButton) {
            return matchedButton;
        }

        return matchedButton;
    }

    function findCourtButton(courtName) {
        const normalizedCourtName = normalizeText(courtName).toUpperCase();
        return Array.from(document.querySelectorAll("button")).find(button => {
            if (!isVisibleButton(button)) {
                return false;
            }

            return normalizeText(button.textContent).toUpperCase() === normalizedCourtName;
        }) || null;
    }

    function getVisibleCourtButtonsSnapshot() {
        return Array.from(document.querySelectorAll("button"))
            .filter(isVisibleButton)
            .map(button => normalizeText(button.textContent).toUpperCase())
            .filter(text => text.startsWith("PICKLEBALL "))
            .join("|");
    }

    function getBookingProgressSignature() {
        return JSON.stringify({
            path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
            next: !!findButton("NEXT"),
            checkout: !!findButton("CHECKOUT", true),
            book: !!findButton("BOOK", true),
        });
    }

    async function waitForTimeSlotSelection(label, beforeSnapshot, beforeSignature) {
        const startedAt = Date.now();

        while (Date.now() - startedAt < CONFIG.timeSlotSettleTimeoutMs) {
            const currentButton = findTimeSlotButton(label);
            const currentSnapshot = getVisibleTimeSlotButtonsSnapshot();
            const currentSignature = getButtonStateSignature(currentButton);

            if (!currentButton) {
                return { settled: true, reason: "button_missing_after_click" };
            }

            if (currentButton.disabled) {
                return { settled: true, reason: "button_disabled" };
            }

            if (currentSignature !== beforeSignature) {
                return { settled: true, reason: "button_state_changed" };
            }

            if (currentSnapshot !== beforeSnapshot) {
                return { settled: true, reason: "slot_list_changed" };
            }

            await wait(CONFIG.timeSlotSettlePollMs);
        }

        return { settled: false, reason: "timeout" };
    }

    async function waitForCourtSelection(courtName, beforeSnapshot, beforeSignature, beforeProgressSignature) {
        const startedAt = Date.now();

        while (Date.now() - startedAt < CONFIG.courtSelectionTimeoutMs) {
            const currentButton = findCourtButton(courtName);
            const currentSnapshot = getVisibleCourtButtonsSnapshot();
            const currentSignature = getButtonStateSignature(currentButton);
            const currentProgressSignature = getBookingProgressSignature();

            if (!currentButton) {
                return { settled: true, reason: "button_missing_after_click" };
            }

            if (currentButton.disabled) {
                return { settled: true, reason: "button_disabled" };
            }

            if (currentSignature !== beforeSignature) {
                return { settled: true, reason: "button_state_changed" };
            }

            if (currentSnapshot !== beforeSnapshot) {
                return { settled: true, reason: "court_list_changed" };
            }

            if (currentProgressSignature !== beforeProgressSignature) {
                return { settled: true, reason: "progress_changed" };
            }

            await wait(CONFIG.courtSelectionPollMs);
        }

        return { settled: false, reason: "timeout" };
    }

    async function clickTimeSlot(label) {
        const targetButton = findTimeSlotButton(label);
        if (!targetButton) {
            setStatus(`Time ${label} is unavailable.`, "warning");
            return { attempted: true, clicked: false, label, reason: "not_found" };
        }

        const beforeSnapshot = getVisibleTimeSlotButtonsSnapshot();
        const beforeSignature = getButtonStateSignature(targetButton);
        const originalAlert = window.alert;
        let alertMessage = "";
        let alertSeen = false;

        window.alert = message => {
            alertSeen = true;
            alertMessage = String(message || "");
            console.log(`Time slot alert: ${alertMessage}`);
        };

        try {
            targetButton.click();
            const alertDeadline = Date.now() + CONFIG.timeSlotAlertWindowMs;
            while (!alertSeen && Date.now() < alertDeadline) {
                await wait(CONFIG.timeSlotAlertPollMs);
            }
        } finally {
            window.alert = originalAlert;
        }

        if (alertSeen) {
            const normalizedAlert = alertMessage.toLowerCase();
            if (normalizedAlert.includes("continuous")) {
                setStatus(`Stopped at ${label}. The site requires continuous slots.`, "warning");
                return { attempted: true, clicked: false, label, reason: "continuous_required" };
            }

            setStatus(`Time ${label} returned a message: ${alertMessage}`, "warning");
            return { attempted: true, clicked: false, label, reason: "alert" };
        }

        setStatus(`Clicked time ${label}. Waiting for the page to settle.`, "info");

        const settleResult = await waitForTimeSlotSelection(label, beforeSnapshot, beforeSignature);
        if (settleResult.settled) {
            setStatus(`Selected time ${label}.`, "success");
        } else {
            setStatus(`Clicked time ${label}, but no clear state change was detected.`, "warning");
        }

        return {
            attempted: true,
            clicked: true,
            label,
            reason: settleResult.reason,
        };
    }

    function getTargetDateInfo() {
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 7);

        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return {
            dayName: dayNames[targetDate.getDay()],
            dayNumber: String(targetDate.getDate()).padStart(2, "0"),
        };
    }

    async function clickDayButton() {
        const { dayName, dayNumber } = getTargetDateInfo();
        setStatus(`Selecting date ${dayName} ${dayNumber}.`, "info");

        const dayButtons = Array.from(document.querySelectorAll(".day-container button"));
        for (const button of dayButtons) {
            const buttonDayName = button.querySelector(".day_name")?.textContent?.trim();
            const buttonDayNumber = button.querySelector(".day_number")?.textContent?.trim();
            if (buttonDayName === dayName && buttonDayNumber === dayNumber) {
                button.click();
                return true;
            }
        }

        for (const button of dayButtons) {
            const buttonDayNumber = button.querySelector(".day_number")?.textContent?.trim();
            if (buttonDayNumber === dayNumber) {
                button.click();
                return true;
            }
        }

        const nextWeekButton = Array.from(document.querySelectorAll("button")).find(button => {
            const text = button.textContent ? button.textContent.trim() : "";
            return text.includes("Next Week") || text.includes(">");
        });

        if (nextWeekButton) {
            nextWeekButton.click();
            await wait(500);
            return clickDayButton();
        }

        setStatus(`Could not find date ${dayName} ${dayNumber}.`, "error");
        return false;
    }

    async function selectPickleball() {
        const pickleballButton = findButton("PICKLEBALL") || findButton("PICKLEBALL", true);
        if (!pickleballButton) {
            setStatus("Pickleball button not found. Continuing anyway.", "warning");
            return false;
        }

        pickleballButton.click();
        setStatus("Pickleball selected.", "success");
        return true;
    }

    async function selectTimeSlots() {
        setStatus("Checking preferred time slots.", "info");
        const results = {
            attemptedCount: 0,
            successCount: 0,
            failedLabels: [],
        };

        while (state.desiredTimeIndex < state.desiredTimes.length) {
            const currentTime = state.desiredTimes[state.desiredTimeIndex];
            setStatus(
                `Selecting time ${state.desiredTimeIndex + 1} of ${state.desiredTimes.length}: ${currentTime}.`,
                "info"
            );
            const slotResult = await clickTimeSlot(currentTime);
            results.attemptedCount += 1;
            if (slotResult.clicked) {
                results.successCount += 1;
            } else {
                results.failedLabels.push(currentTime);
                if (results.successCount > 0 || slotResult.reason === "continuous_required") {
                    setStatus(`Stopping after ${currentTime} so the selected block stays continuous.`, "warning");
                    break;
                }
            }

            state.desiredTimeIndex += 1;
            if (CONFIG.timeSlotInterClickDelayMs > 0) {
                await wait(CONFIG.timeSlotInterClickDelayMs);
            }
        }

        if (results.failedLabels.length) {
            setStatus(
                `Attempted all ${results.attemptedCount} time slots. Missing: ${results.failedLabels.join(", ")}.`,
                "warning"
            );
        } else {
            setStatus(`Attempted all ${results.attemptedCount} time slots successfully.`, "success");
        }

        return results;
    }

    async function selectCourt() {
        const remainingCourts = getRemainingCourtPriority();
        state.currentCourtName = null;
        let attemptedSelection = false;

        if (!remainingCourts.length) {
            setStatus("All courts in the saved priority list have already been tried.", "warning");
            return { selected: false, reason: "exhausted" };
        }

        setStatus(`Selecting the best available court from ${remainingCourts.join(", ")}.`, "info");

        for (const [courtIndex, targetCourtName] of state.courtPriority.entries()) {
            if (state.triedCourts.includes(targetCourtName)) {
                continue;
            }

            const courtButton = Array.from(document.querySelectorAll("button")).find(button => {
                const text = button.textContent ? button.textContent.trim().toUpperCase() : "";
                return isVisibleButton(button) && text === targetCourtName;
            });

            if (courtButton) {
                attemptedSelection = true;
                const beforeSnapshot = getVisibleCourtButtonsSnapshot();
                const beforeSignature = getButtonStateSignature(courtButton);
                const beforeProgressSignature = getBookingProgressSignature();

                courtButton.click();
                setStatus(`Clicked court ${targetCourtName}. Waiting for the page to settle.`, "info");

                const settleResult = await waitForCourtSelection(
                    targetCourtName,
                    beforeSnapshot,
                    beforeSignature,
                    beforeProgressSignature
                );

                if (!settleResult.settled) {
                    setStatus(`Court ${targetCourtName} did not settle after the click. Trying the next court.`, "warning");
                    continue;
                }

                state.currentCourtName = targetCourtName;
                setStatus(`Selected court ${targetCourtName}.`, "success");
                return { selected: true, courtName: targetCourtName, courtIndex, selectionReason: settleResult.reason };
            }
        }

        if (attemptedSelection) {
            setStatus("Tried the remaining visible courts, but none of the selections stuck.", "error");
            return { selected: false, reason: "exhausted" };
        }

        setStatus(`No available court matched the remaining priority list: ${remainingCourts.join(", ")}.`, "error");
        return { selected: false, reason: "exhausted" };
    }

    async function proceedAfterCourtSelection() {
        const nextButton = findButton("NEXT");
        if (!nextButton) {
            setStatus("NEXT button was not found after court selection.", "error");
            return false;
        }

        nextButton.click();
        setStatus("Moving to player selection.", "info");
        return true;
    }

    async function addFriendByName() {
        const openAddUsersButton = findButton("ADD USERS");
        if (!openAddUsersButton) {
            setStatus("ADD USERS button not found. Continuing to the next step.", "warning");
            return false;
        }

        openAddUsersButton.click();
        await wait(200);

        const addButton = findButton("ADD");
        if (!addButton) {
            setStatus("ADD button not found in the user modal.", "warning");
            return false;
        }

        addButton.click();
        setStatus("Users added.", "success");
        return true;
    }

    async function proceedToFinalStep() {
        const nextButton = findButton("NEXT");
        if (!nextButton) {
            setStatus("Final NEXT button not found. Trying to continue.", "warning");
            return false;
        }

        nextButton.click();
        setStatus("Moving to the final booking step.", "info");
        return true;
    }

    function getStepperStatusMessage(stepTitle) {
        return stepTitle === "Select date and time"
            ? "Returning to date and time selection."
            : `Opening ${stepTitle}.`;
    }

    async function openStepper(stepTitle) {
        const normalizedStepTitle = normalizeText(stepTitle).toLowerCase();
        const matchesTitle = element => normalizeText(element?.textContent || "").toLowerCase().includes(normalizedStepTitle);
        const clickStepperTarget = target => {
            (target.closest("tr.header") || target).click();
        };

        const exactStructure = Array.from(document.querySelectorAll("tr.header td h2.mb0.stepper_title")).find(matchesTitle);
        if (exactStructure) {
            clickStepperTarget(exactStructure);
            setStatus(getStepperStatusMessage(stepTitle), "info");
            await wait(500);
            return true;
        }

        const stepperRow = Array.from(document.querySelectorAll("tr.header")).find(row => {
            return matchesTitle(row.querySelector("h2.mb0.stepper_title"));
        });

        if (stepperRow) {
            const clickTarget = stepperRow.querySelector("h2.mb0.stepper_title") || stepperRow;
            clickStepperTarget(clickTarget);
            setStatus(getStepperStatusMessage(stepTitle), "info");
            await wait(500);
            return true;
        }

        const alternateTarget = Array.from(document.querySelectorAll("h2.mb0.stepper_title")).find(matchesTitle);
        if (alternateTarget) {
            clickStepperTarget(alternateTarget);
            setStatus(getStepperStatusMessage(stepTitle), "info");
            await wait(500);
            return true;
        }

        const allElements = Array.from(document.querySelectorAll("*"));
        for (const element of allElements) {
            const text = normalizeText(element.textContent || "").toLowerCase();
            if (!text.includes(normalizedStepTitle)) {
                continue;
            }

            if (!["H2", "TD", "TR"].includes(element.tagName)) {
                continue;
            }

            clickStepperTarget(element);
            setStatus(getStepperStatusMessage(stepTitle), "info");
            await wait(500);
            return true;
        }

        const fallbackStepper = Array.from(document.querySelectorAll(".stepper_title")).find(matchesTitle);
        if (fallbackStepper) {
            clickStepperTarget(fallbackStepper);
            setStatus(`Attempting to open ${stepTitle}.`, "warning");
            await wait(500);
            return true;
        }

        setStatus(`${stepTitle} stepper not found.`, "error");
        return false;
    }

    async function waitForBookButton() {
        const startedAt = Date.now();

        while (Date.now() - startedAt < CONFIG.bookingResultTimeoutMs) {
            const bookButton = findButton("BOOK", true);
            if (bookButton) {
                return bookButton;
            }

            await wait(CONFIG.bookingResultPollMs);
        }

        return null;
    }

    async function ensureCheckoutStep(options = {}) {
        const { forceOpen = false } = options;

        if (!forceOpen && findButton("BOOK", true)) {
            return true;
        }

        const openedCheckout = await openStepper("Checkout");
        if (!openedCheckout) {
            setStatus("Checkout stepper not found and BOOK button is unavailable.", "error");
            return false;
        }

        const bookButton = await waitForBookButton();
        if (bookButton) {
            return true;
        }

        setStatus("Checkout opened, but BOOK is still unavailable.", "error");
        return false;
    }

    async function waitForCourtSelectionScreen() {
        const startedAt = Date.now();

        while (Date.now() - startedAt < CONFIG.courtSelectionTimeoutMs) {
            const hasCourtButtons = state.courtPriority.some(courtName => {
                return Array.from(document.querySelectorAll("button")).some(button => {
                    const text = button.textContent ? button.textContent.trim().toUpperCase() : "";
                    return isVisibleButton(button) && text === courtName;
                });
            });

            if (hasCourtButtons) {
                return true;
            }

            await wait(CONFIG.courtSelectionPollMs);
        }

        setStatus("Court list did not reappear after returning to Select date and time.", "error");
        return false;
    }

    async function finalizeBooking() {
        const alertRoot = document.documentElement;
        const alertArmedAttribute = "data-pickleball-booking-alert-armed";
        const alertSeenAttribute = "data-pickleball-booking-alert-seen";
        const alertMessageAttribute = "data-pickleball-booking-alert-message";
        const bookButton = findButton("BOOK", true);
        if (!bookButton) {
            setStatus("BOOK button not found.", "error");
            return { success: false, reason: "book_missing", retryable: false, courtName: state.currentCourtName };
        }

        if (!alertRoot) {
            setStatus("Booking alert bridge is unavailable on this page.", "error");
            return { success: false, reason: "bridge_unavailable", retryable: false, courtName: state.currentCourtName };
        }

        const originalLocation = window.location.href;

        try {
            alertRoot.setAttribute(alertArmedAttribute, "true");
            alertRoot.setAttribute(alertSeenAttribute, "false");
            alertRoot.removeAttribute(alertMessageAttribute);

            bookButton.click();
            setStatus("Submitting booking request.", "info");

            const startedAt = Date.now();
            while (Date.now() - startedAt < CONFIG.bookingResultTimeoutMs) {
                if (alertRoot.getAttribute(alertSeenAttribute) === "true") {
                    break;
                }

                if (window.location.href !== originalLocation) {
                    break;
                }

                if (!findButton("BOOK", true)) {
                    break;
                }

                await wait(CONFIG.bookingResultPollMs);
            }
        } finally {
            alertRoot.setAttribute(alertArmedAttribute, "false");
        }

        const alertSeen = alertRoot.getAttribute(alertSeenAttribute) === "true";
        const alertMessage = alertRoot.getAttribute(alertMessageAttribute) || "";

        alertRoot.setAttribute(alertSeenAttribute, "false");
        alertRoot.removeAttribute(alertMessageAttribute);

        if (!alertSeen) {
            if (window.location.href !== originalLocation || !findButton("BOOK", true)) {
                setStatus("Booking completed.", "success");
                return { success: true, reason: "success", retryable: false, courtName: state.currentCourtName };
            }

            setStatus("BOOK was clicked, but the page stayed on checkout. Retrying the next court.", "warning");
            return { success: false, reason: "book_stalled", retryable: true, courtName: state.currentCourtName };
        }

        console.log(`Booking alert acknowledged: ${alertMessage}`);
        setStatus(`Booking alert acknowledged: ${alertMessage}`, "warning");
        return {
            success: false,
            reason: "booking_alert",
            retryable: true,
            alertMessage,
            courtName: state.currentCourtName,
        };
    }

    async function goBackToDateTimeSelection() {
        return openStepper("Select date and time");
    }

    function getCountdownParts() {
        const hour = getXPathText(CONFIG.countdownHourXPath);
        const minute = getXPathText(CONFIG.countdownMinuteXPath);
        const second = getXPathText(CONFIG.countdownSecondXPath);

        if (!hour || !minute || !second) {
            return null;
        }

        return {
            hour: hour.padStart(2, "0"),
            minute: minute.padStart(2, "0"),
            second: second.padStart(2, "0"),
        };
    }

    async function waitForCountdownToEnd() {
        await wait(CONFIG.countdownInitialDelayMs);

        let count = getXPathCount(CONFIG.countdownMessageXPath);
        let loopCounter = 0;

        if (count < 1) {
            setCountdown("No countdown shown.", "success");
            return false;
        }

        setStatus("Countdown detected. Waiting for booking to open.", "info");
        setMode("Waiting");

        while (count > 0) {
            if (state.waitCancelled) {
                setCountdown("Cancelled.", "error");
                return true;
            }

            const parts = getCountdownParts();
            if (parts) {
                const countdownText = `${parts.hour}:${parts.minute}:${parts.second}`;
                setCountdown(countdownText, "info");
                if (loopCounter % 10 === 0) {
                    console.log(`Time left remaining: ${countdownText}`);
                }
            } else {
                setCountdown("Waiting for countdown...", "warning");
            }

            await wait(CONFIG.countdownPollMs);
            count = getXPathCount(CONFIG.countdownMessageXPath);
            loopCounter += 1;
        }

        setCountdown("00:00:00", "success");
        return true;
    }

    async function runBookingAttempt() {
        const selectedDay = await clickDayButton();
        await wait(selectedDay ? 350 : 1000);

        await selectPickleball();
        await wait(CONFIG.actionDelayMs);

        await selectTimeSlots();
        await wait(CONFIG.actionDelayMs);

        const courtSelected = await selectCourt();
        if (!courtSelected.selected) {
            return { success: false, reason: courtSelected.reason, retryable: false };
        }

        await wait(200);

        const proceededAfterCourt = await proceedAfterCourtSelection();
        if (!proceededAfterCourt) {
            return { success: false, reason: "court_next_missing", retryable: false, courtName: courtSelected.courtName };
        }

        await wait(200);
        await addFriendByName();
        await wait(230);
        const reachedFinalStep = await proceedToFinalStep();
        if (!reachedFinalStep) {
            return { success: false, reason: "final_next_missing", retryable: false, courtName: courtSelected.courtName };
        }

        await wait(250);
        const checkoutReady = await ensureCheckoutStep();
        if (!checkoutReady) {
            return { success: false, reason: "checkout_unavailable", retryable: false, courtName: courtSelected.courtName };
        }

        await wait(250);

        return finalizeBooking();
    }

    async function retryBookingWithNextCourt() {
        const returned = await goBackToDateTimeSelection();
        if (!returned) {
            return { success: false, reason: "date_time_stepper_missing", retryable: false };
        }

        const courtSelectionReady = await waitForCourtSelectionScreen();
        if (!courtSelectionReady) {
            return { success: false, reason: "court_list_missing", retryable: false };
        }

        const courtSelected = await selectCourt();
        if (!courtSelected.selected) {
            return { success: false, reason: courtSelected.reason, retryable: false };
        }

        await wait(250);
        const checkoutReady = await ensureCheckoutStep({ forceOpen: true });
        if (!checkoutReady) {
            return { success: false, reason: "checkout_unavailable", retryable: false, courtName: courtSelected.courtName };
        }

        await wait(250);
        return finalizeBooking();
    }

    function shouldRetryWithNextCourt(result) {
        return !!result && result.retryable && ["booking_alert", "book_stalled"].includes(result.reason);
    }

    function rememberTriedCourt(courtName) {
        if (courtName && !state.triedCourts.includes(courtName)) {
            state.triedCourts.push(courtName);
        }
    }

    function getRetryStatusMessage(result, nextCourtName) {
        const currentCourtName = result.courtName || "the current court";
        if (result.reason === "book_stalled") {
            return `BOOK did not leave checkout for ${currentCourtName}. Retrying with next court: ${nextCourtName}.`;
        }

        return `Booking alert acknowledged for ${currentCourtName}. Retrying with next court: ${nextCourtName}.`;
    }

    async function startBookingFlow() {
        ensurePanel();

        if (state.runPromise) {
            setStatus("A booking run is already active.", "warning");
            return state.runPromise;
        }

        await state.courtPriorityReady;

        if (state.runPromise) {
            setStatus("A booking run is already active.", "warning");
            return state.runPromise;
        }

        if (!syncDesiredTimesFromInput()) {
            setMode("Needs Input");
            return null;
        }

        state.waitCancelled = false;
        state.runPromise = (async () => {
            setMode("Preparing");
            setStatus(
                `Checking for the booking countdown with ${state.desiredTimes.length} desired time slots. Top court: ${state.courtPriority[0]}.`,
                "info"
            );
            state.desiredTimeIndex = 0;
            state.bookingAttempts = 0;
            state.triedCourts = [];
            state.currentCourtName = null;

            const waitedForCountdown = await waitForCountdownToEnd();
            if (state.waitCancelled) {
                setMode("Cancelled");
                setStatus("Waiting was cancelled.", "warning");
                return;
            }

            setMode("Booking");
            setStatus(
                waitedForCountdown
                    ? "Countdown finished. Starting the booking flow."
                    : "No countdown found. Starting the booking flow.",
                "info"
            );

            state.bookingAttempts = 1;
            state.desiredTimeIndex = 0;

            let result = await runBookingAttempt();
            if (result.success) {
                setMode("Done");
                return;
            }

            if (shouldRetryWithNextCourt(result)) {
                rememberTriedCourt(result.courtName);
            } else if (result.reason === "exhausted") {
                setMode("Failed");
                setStatus("No more saved courts are available to try for this booking run.", "error");
                return;
            } else if (!result.retryable) {
                setMode("Stopped");
                return;
            }

            while (shouldRetryWithNextCourt(result)) {
                const remainingCourts = getRemainingCourtPriority();
                if (!remainingCourts.length) {
                    setMode("Failed");
                    setStatus(
                        result.reason === "book_stalled"
                            ? `BOOK never left checkout for ${result.courtName || "the current court"}. No more saved courts remain to try.`
                            : `Booking alert acknowledged for ${result.courtName || "the current court"}. No more saved courts remain to try.`,
                        "error"
                    );
                    return;
                }

                setStatus(getRetryStatusMessage(result, remainingCourts[0]), "warning");

                state.bookingAttempts += 1;
                result = await retryBookingWithNextCourt();
                if (result.success) {
                    setMode("Done");
                    return;
                }

                if (shouldRetryWithNextCourt(result)) {
                    rememberTriedCourt(result.courtName);
                    continue;
                }

                if (result.reason === "exhausted") {
                    setMode("Failed");
                    setStatus("No more saved courts are available to try for this booking run.", "error");
                    return;
                }

                if (!result.retryable) {
                    setMode("Stopped");
                    return;
                }
            }

            setMode("Stopped");
        })().finally(() => {
            state.runPromise = null;
        });

        return state.runPromise;
    }

    function cancelPendingWork() {
        state.waitCancelled = true;

        if (state.scheduledTimer) {
            window.clearTimeout(state.scheduledTimer);
            state.scheduledTimer = null;
        }

        setMode("Cancelled");
        setStatus("Scheduled work or waiting was cancelled.", "warning");
        setCountdown("Cancelled.", "error");
    }

    function scheduleBooking() {
        ensurePanel();

        if (!syncDesiredTimesFromInput()) {
            setMode("Needs Input");
            return;
        }

        if (!syncScheduleTimeFromInputs()) {
            setMode("Needs Input");
            return;
        }

        if (state.scheduledTimer) {
            window.clearTimeout(state.scheduledTimer);
        }

        const delayMs = calculateDelayUntilTargetTime(state.scheduleHour, state.scheduleMinute);
        const targetLabel = formatTime12Hour(state.scheduleHour, state.scheduleMinute);
        const hours = Math.floor(delayMs / (1000 * 60 * 60));
        const minutes = Math.floor((delayMs % (1000 * 60 * 60)) / (1000 * 60));

        state.waitCancelled = false;
        state.scheduledTimer = window.setTimeout(() => {
            state.scheduledTimer = null;
            startBookingFlow();
        }, delayMs);

        setMode("Scheduled");
        setCountdown("Waiting for schedule.", "info");
        setStatus(`Booking scheduled for ${targetLabel} in about ${hours}h ${minutes}m.`, "success");
    }

    const api = {
        handleAction(action) {
            ensurePanel();

            if (action === "schedule") {
                scheduleBooking();
                return;
            }

            if (action === "panel" || action === "start") {
                setMode("Ready");
                setStatus("Page panel is open. Drag courts, enter a booking range, then use the page buttons.", "success");
                setCountdown("Not started");
                return;
            }

            api.startImmediate();
        },
        startImmediate() {
            cancelPendingWork();
            state.waitCancelled = false;
            setCountdown("Checking page...", "info");
            return startBookingFlow();
        },
        scheduleBooking,
        cancelPendingWork,
    };

    window.PickleballBooking = api;
})();
