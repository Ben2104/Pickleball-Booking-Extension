document.getElementById("bookNow").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
                // Configuration options
                const desiredTimes = ["6-6:30pm", "6:30-7pm", "7-7:30pm", "7:30-8pm"];
                const targetHour = 7; // Target hour for scheduling (7:00 AM)
                const targetMinute = 0;
                book = false

                // Maximum number of booking retry attempts
                let bookingAttempts = 0;
                const MAX_BOOKING_ATTEMPTS = 3;

                // Court priority (highest to lowest)
                const courtPriorityMap = new Map([
                    [0, "PICKLEBALL 2"],
                    [1, "PICKLEBALL 4"],
                    [2, "PICKLEBALL 8"],
                    [3, "PICKLEBALL 9"],
                    [4, "PICKLEBALL 3"],
                    [5, "PICKLEBALL 6"],
                    [6, "PICKLEBALL 7"],
                    [7, "PICKLEBALL 1"],
                    [8, "PICKLEBALL 5"],
                    [9, "PICKLEBALL 10"],
                ]);

                // Global variables
                let index = 0;
                let scheduledTimer = null;

                // =====================================================
                // UI and Status Functions
                // =====================================================

                function showStatus(message, isError = false) {
                    let statusDiv = document.getElementById("booking-status");
                    if (!statusDiv) {
                        statusDiv = document.createElement("div");
                        statusDiv.id = "booking-status";
                        statusDiv.style.position = "fixed";
                        statusDiv.style.top = "10px";
                        statusDiv.style.right = "10px";
                        statusDiv.style.padding = "10px";
                        statusDiv.style.borderRadius = "5px";
                        statusDiv.style.zIndex = "9999";
                        statusDiv.style.fontWeight = "bold";
                        document.body.appendChild(statusDiv);
                    }

                    statusDiv.textContent = message;
                    statusDiv.style.backgroundColor = isError ? "#ffcccc" : "#ccffcc";
                    statusDiv.style.border = isError ? "2px solid #ff0000" : "2px solid #00aa00";
                }

                function createControlPanel() {
                    const existingPanel = document.getElementById("booking-control-panel");
                    if (existingPanel) existingPanel.remove();

                    const panel = document.createElement("div");
                    panel.id = "booking-control-panel";
                    panel.style.position = "fixed";
                    panel.style.bottom = "20px";
                    panel.style.right = "20px";
                    panel.style.backgroundColor = "#ffffff";
                    panel.style.border = "2px solid #cccccc";
                    panel.style.borderRadius = "10px";
                    panel.style.padding = "15px";
                    panel.style.zIndex = "9999";
                    panel.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";

                    const title = document.createElement("h3");
                    title.textContent = "Pickleball Booking";
                    title.style.margin = "0 0 10px 0";
                    title.style.padding = "0";
                    panel.appendChild(title);

                    // Book Now button
                    const bookNowBtn = document.createElement("button");
                    bookNowBtn.textContent = "Book Now";
                    bookNowBtn.style.display = "block";
                    bookNowBtn.style.width = "100%";
                    bookNowBtn.style.padding = "8px";
                    bookNowBtn.style.marginBottom = "10px";
                    bookNowBtn.style.backgroundColor = "#4CAF50";
                    bookNowBtn.style.color = "white";
                    bookNowBtn.style.border = "none";
                    bookNowBtn.style.borderRadius = "5px";
                    bookNowBtn.style.cursor = "pointer";
                    bookNowBtn.addEventListener("click", () => {
                        if (scheduledTimer) {
                            clearTimeout(scheduledTimer);
                            scheduledTimer = null;
                        }
                        startBookingProcess();
                    });
                    panel.appendChild(bookNowBtn);

                    // Schedule button
                    const scheduleBtn = document.createElement("button");
                    scheduleBtn.textContent = `Schedule for ${formatTime12Hour(targetHour, targetMinute)}`;
                    scheduleBtn.style.display = "block";
                    scheduleBtn.style.width = "100%";
                    scheduleBtn.style.padding = "8px";
                    scheduleBtn.style.backgroundColor = "#2196F3";
                    scheduleBtn.style.color = "white";
                    scheduleBtn.style.border = "none";
                    scheduleBtn.style.borderRadius = "5px";
                    scheduleBtn.style.cursor = "pointer";
                    scheduleBtn.addEventListener("click", scheduleBooking);
                    panel.appendChild(scheduleBtn);

                    document.body.appendChild(panel);

                    console.log("✅ Control panel created");
                }

                function addCancelButton() {
                    const existingBtn = document.getElementById("cancel-scheduled-booking");
                    if (existingBtn) existingBtn.remove();

                    const cancelBtn = document.createElement("button");
                    cancelBtn.id = "cancel-scheduled-booking";
                    cancelBtn.textContent = "Cancel Scheduled Booking";
                    cancelBtn.style.position = "fixed";
                    cancelBtn.style.top = "60px";
                    cancelBtn.style.right = "10px";
                    cancelBtn.style.padding = "5px 10px";
                    cancelBtn.style.backgroundColor = "#ff6666";
                    cancelBtn.style.color = "white";
                    cancelBtn.style.border = "none";
                    cancelBtn.style.borderRadius = "5px";
                    cancelBtn.style.cursor = "pointer";
                    cancelBtn.style.zIndex = "9999";

                    cancelBtn.addEventListener("click", () => {
                        if (scheduledTimer) {
                            clearTimeout(scheduledTimer);
                            scheduledTimer = null;
                            console.log("❌ Scheduled booking cancelled");
                            showStatus("❌ Scheduled booking cancelled", true);
                            cancelBtn.remove();
                        }
                    });

                    document.body.appendChild(cancelBtn);
                }

                // =====================================================
                // Utility Functions
                // =====================================================

                function calculateDelayUntilTargetTime(hours, minutes) {
                    const now = new Date();
                    const targetTime = new Date(now);
                    targetTime.setHours(hours, minutes, 0, 0);

                    if (now > targetTime) {
                        targetTime.setDate(targetTime.getDate() + 1); // Schedule for the next day
                    }

                    return targetTime - now; // Return delay in milliseconds
                }

                function formatTime12Hour(hour, minute) {
                    const period = hour >= 12 ? "PM" : "AM";
                    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
                    const paddedMinute = String(minute).padStart(2, "0");
                    return `${hour12}:${paddedMinute} ${period}`;
                }

                function findButton(criteria, partialMatch = false) {
                    return Array.from(document.querySelectorAll("button"))
                        .find(btn => {
                            const text = btn.textContent.trim().toUpperCase();
                            return partialMatch ? text.includes(criteria) : text === criteria;
                        });
                }

                function scheduleBooking() {
                    if (scheduledTimer) clearTimeout(scheduledTimer);

                    const delayMs = calculateDelayUntilTargetTime(targetHour, targetMinute);
                    const formattedTime = formatTime12Hour(targetHour, targetMinute);

                    const hours = Math.floor(delayMs / (1000 * 60 * 60));
                    const minutes = Math.floor((delayMs % (1000 * 60 * 60)) / (1000 * 60));

                    console.log(`⏳ Booking scheduled in ${hours}h ${minutes}m (${delayMs / 1000} seconds)`);
                    showStatus(`⏰ Booking scheduled for ${formattedTime}`);

                    scheduledTimer = setTimeout(() => {
                        console.log(`🚀 Automatic booking triggered!`);
                        showStatus("🚀 Running scheduled booking now...");
                        startBookingProcess();
                    }, delayMs);

                    console.log("✅ Timer set for scheduled booking");
                    addCancelButton();
                }

                // =====================================================
                // NEW: Day Selection Function
                // =====================================================

                function getTargetDateInfo() {
                    // Create a date object for 7 days from today
                    const today = new Date();
                    const targetDate = new Date(today);
                    targetDate.setDate(today.getDate() + 7);

                    // Get day of week as a 3-letter abbreviation
                    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                    const dayName = dayNames[targetDate.getDay()];

                    // Get day number with leading zero if needed
                    const dayNumber = String(targetDate.getDate()).padStart(2, '0');

                    return { dayName, dayNumber };
                }

                function clickDayButton() {
                    const { dayName, dayNumber } = getTargetDateInfo();
                    console.log(`🗓️ Looking for day button: ${dayName} ${dayNumber}`);
                    showStatus(`🗓️ Selecting date: ${dayName} ${dayNumber}...`);

                    // Try different ways to find the day button

                    // Method 1: Find by exact button content
                    const dayButtons = Array.from(document.querySelectorAll(".day-container button"));

                    for (let btn of dayButtons) {
                        const btnDayName = btn.querySelector(".day_name")?.textContent;
                        const btnDayNumber = btn.querySelector(".day_number")?.textContent;

                        if (btnDayName === dayName && btnDayNumber === dayNumber) {
                            console.log(`✅ Found exact day button: ${dayName} ${dayNumber}`);
                            btn.click();
                            return true;
                        }
                    }

                    // Method 2: Find by day number only if exact match failed
                    for (let btn of dayButtons) {
                        const btnDayNumber = btn.querySelector(".day_number")?.textContent;

                        if (btnDayNumber === dayNumber) {
                            console.log(`⚠️ Found day by number only: ${btnDayNumber}`);
                            btn.click();
                            return true;
                        }
                    }

                    // Method 3: If buttons exist but desired day wasn't found, try using "Next Week" button first
                    const nextWeekBtn = Array.from(document.querySelectorAll("button")).find(btn =>
                        btn.textContent.includes("Next Week") || btn.textContent.includes("→")
                    );

                    if (nextWeekBtn && dayButtons.length > 0) {
                        console.log("⚠️ Desired day not found. Clicking 'Next Week' button");
                        nextWeekBtn.click();

                        // Wait for page to update then try again
                        setTimeout(() => {
                            clickDayButton();
                        }, 500);
                        return true;
                    }

                    console.error(`❌ Could not find day button for ${dayName} ${dayNumber}`);
                    showStatus(`❌ Day ${dayName} ${dayNumber} not found!`, true);
                    return false;
                }

                // =====================================================
                // Core Booking Process
                // =====================================================

                function startBookingProcess() {
                    console.log("🚀 Starting booking automation");
                    showStatus("🚀 Starting booking process...");
                    bookingAttempts = 0; // Reset the counter at the start

                    // Organize the booking process into a clear flow
                    const bookingFlow = {
                        // Step 1: Select the day (7 days from today)
                        selectDay: function () {
                            if (clickDayButton()) {
                                console.log("✅ Selected target day");
                                // Use arrow function to preserve 'this' context
                                setTimeout(() => this.selectPickleball(), 350);
                            } else {
                                console.error("❌ Failed to select target day");
                                showStatus("❌ Date selection failed", true);

                                // Try to continue anyway
                                console.log("⚠️ Attempting to continue despite date selection failure");
                                // Use arrow function to preserve 'this' context
                                setTimeout(() => this.selectPickleball(), 1000);
                            }
                        },

                        // Step 2: Select Pickleball
                        selectPickleball: function () {
                            let pickleballBtn = findButton("PICKLEBALL") || findButton("PICKLEBALL", true);
                            if (pickleballBtn) {
                                pickleballBtn.click();
                                console.log("✅ Clicked Pickleball button");
                                showStatus("✅ Selected Pickleball");
                                // Use arrow function to preserve 'this' context
                                setTimeout(() => this.selectTimeSlot(), 350);
                            } else {
                                console.error("❌ Pickleball button not found");
                                showStatus("❌ Pickleball button not found!", true);

                                // If we can't find Pickleball button, attempt to go directly to time selection
                                console.log("⚠️ Attempting to proceed directly to time slot selection");
                                // Use arrow function to preserve 'this' context
                                setTimeout(() => this.selectTimeSlot(), 500);
                            }
                        },

                        // Step 3: Select Time Slot
                        selectTimeSlot: function () {
                            console.log("🕒 Looking for available time slots...");
                            if (index >= desiredTimes.length) {
                                console.log("✅ All time slots attempted. Proceeding to court selection...");
                                showStatus("✅ Attempted all time slots. Proceeding to court selection...");
                                // Use arrow function to preserve 'this' context
                                setTimeout(() => bookingFlow.selectCourt(), 250);
                                return;
                            }

                            // Add debugging to see what's on the page
                            console.log(`Found ${document.querySelectorAll("button").length} total buttons on page`);

                            // Reduced delay for buttons to fully load (from 500ms to 400ms)
                            setTimeout(() => {
                                const buttons = document.querySelectorAll("button");
                                const currentTime = desiredTimes[index];

                                console.log(`🔍 Looking for time slot: "${currentTime}" (Attempt ${index + 1}/${desiredTimes.length})`);

                                // Enhanced button finding logic with multiple methods
                                let button = null;

                                // Method 1: Direct text match (fast path)
                                for (let i = 0; i < buttons.length; i++) {
                                    if (buttons[i].textContent.trim() === currentTime && !buttons[i].disabled) {
                                        button = buttons[i];
                                        console.log(`✅ Found exact match for "${currentTime}"`);
                                        break;
                                    }
                                }

                                // Method 2: Partial text match if exact match failed
                                if (!button) {
                                    for (let i = 0; i < buttons.length; i++) {
                                        const btnText = buttons[i].textContent.trim();
                                        if (btnText.includes(currentTime) && !buttons[i].disabled) {
                                            button = buttons[i];
                                            console.log(`✅ Found partial match for "${currentTime}": "${btnText}"`);
                                            break;
                                        }
                                    }
                                }

                                // Method 3: Try matching with only the time component (most aggressive)
                                if (!button) {
                                    // Extract just the numeric time part (e.g., "7:30")
                                    const timeMatch = currentTime.match(/(\d+(?:[-:]\d+)?)/);
                                    if (timeMatch && timeMatch[0]) {
                                        const timeOnly = timeMatch[0];
                                        for (let i = 0; i < buttons.length; i++) {
                                            if (buttons[i].textContent.includes(timeOnly) && !buttons[i].disabled) {
                                                button = buttons[i];
                                                console.log(`✅ Found time-only match for "${timeOnly}" in "${buttons[i].textContent.trim()}"`);
                                                break;
                                            }
                                        }
                                    }
                                }

                                if (button) {
                                    button.click();
                                    console.log(`✅ Clicked ${currentTime}`);
                                    showStatus(`✅ Selected time: ${currentTime}`);
                                } else {
                                    console.warn(`⚠️ Button for "${currentTime}" not found or disabled.`);
                                    showStatus(`⚠️ Time ${currentTime} not available`, true);
                                }

                                // Always increment index and try the next time slot
                                index++;

                                // Reduced delay between time slot attempts to 350ms (from 400ms)
                                setTimeout(() => bookingFlow.selectTimeSlot(), 35);
                            }, 70); // Reduced delay from 500ms to 400ms
                        },
                        // Step 4: Select Court
                        selectCourt: function () {
                            console.log("🏟️ Prioritizing courts in this order:", Array.from(courtPriorityMap.values()));
                            showStatus("🏟️ Selecting the best available court...");

                            // Go through courts in priority order
                            for (let i = 0; i < courtPriorityMap.size; i++) {
                                const targetCourtName = courtPriorityMap.get(i);
                                const courtBtn = Array.from(document.querySelectorAll("button"))
                                    .find(btn => {
                                        const btnText = btn.textContent.trim().toUpperCase();
                                        return btnText === targetCourtName &&
                                            !btn.disabled &&
                                            btn.offsetParent !== null;
                                    });

                                if (courtBtn) {
                                    courtBtn.click();
                                    console.log(`✅ Selected priority #${i} court: ${targetCourtName}`);
                                    showStatus(`✅ Selected court: ${targetCourtName}`);
                                    setTimeout(bookingFlow.proceedAfterCourtSelection, 200);
                                    return;
                                }
                            }

                            console.error("❌ No available courts found based on priority.");
                            showStatus("❌ No available courts found!", true);
                        },

                        // Step 5: Proceed After Court Selection
                        proceedAfterCourtSelection: function () {
                            const nextBtn = findButton("NEXT");

                            if (nextBtn) {
                                nextBtn.click();
                                console.log("✅ Clicked NEXT after court selection");
                                showStatus("✅ Court selected. Adding users...");
                                setTimeout(bookingFlow.addFriendByName, 200);
                            } else {
                                console.error("❌ NEXT button not found");
                                showStatus("❌ NEXT button not found!", true);
                                alert("Couldn't proceed after court selection - NEXT button missing");
                            }
                        },

                        // Step 6: Add Friend
                        addFriendByName: function () {
                            const openAddUsersBtn = findButton("ADD USERS");

                            if (!openAddUsersBtn) {
                                console.error("❌ ADD USERS button not found");
                                showStatus("❌ ADD USERS button not found!", true);

                                // Try to continue anyway
                                setTimeout(bookingFlow.proceedToFinalStep, 200);
                                return;
                            }

                            openAddUsersBtn.click();
                            console.log("✅ Clicked 'ADD USERS'");
                            showStatus("👥 Adding users...");

                            setTimeout(() => {
                                const addBtn = findButton("ADD");

                                if (!addBtn) {
                                    console.error("❌ ADD button not found in modal");
                                    showStatus("❌ ADD button not found in modal!", true);

                                    // Try to continue anyway
                                    setTimeout(bookingFlow.proceedToFinalStep, 250);
                                    return;
                                }

                                addBtn.click();
                                console.log("✅ Clicked 'ADD' in modal");
                                showStatus("✅ Users added successfully");
                                setTimeout(bookingFlow.proceedToFinalStep, 230);
                            }, 200);
                        },

                        // Step 7: Click Final Next
                        proceedToFinalStep: function () {
                            const nextBtn = findButton("NEXT");

                            if (nextBtn) {
                                nextBtn.click();
                                console.log("✅ Clicked final NEXT button");
                                showStatus("➡️ Proceeding to final booking step...");
                                setTimeout(bookingFlow.finalizeBooking, 250);
                            } else {
                                console.error("❌ Final NEXT button not found");
                                showStatus("❌ Final NEXT button not found!", true);

                                // Try to find the book button directly
                                setTimeout(bookingFlow.finalizeBooking, 250);
                            }
                        },

                        // Step 8: Complete Booking
                        finalizeBooking: function () {
                            const bookBtn = findButton("BOOK", true);

                            bookBtn.click();
                            book = true;
                            if (book) {
                                // Override default alerts BEFORE clicking the button
                                const originalAlert = window.alert;
                                window.alert = function (message) {
                                    console.log(`🔔 Alert detected: "${message}"`);

                                    // Check if this is a booking failure alert
                                    if (message.toLowerCase().includes("already booked") ||
                                        message.toLowerCase().includes("unavailable") ||
                                        message.toLowerCase().includes("no longer available") ||
                                        message.toLowerCase().includes("conflict") ||
                                        message.toLowerCase().includes("reserved")) {

                                        bookingAttempts++;
                                        console.log(`⚠️ Court already booked! Attempt ${bookingAttempts}/${MAX_BOOKING_ATTEMPTS}`);
                                        showStatus(`⚠️ Court already booked! Trying again (${bookingAttempts}/${MAX_BOOKING_ATTEMPTS})`, true);

                                        // Restore original alert function
                                        window.alert = originalAlert;

                                        if (bookingAttempts >= MAX_BOOKING_ATTEMPTS) {
                                            console.error(`❌ Failed after ${MAX_BOOKING_ATTEMPTS} attempts`);
                                            showStatus(`❌ Failed after ${MAX_BOOKING_ATTEMPTS} attempts`, true);
                                            return;
                                        }

                                        // Click the "Select date and time" stepper to go back
                                        setTimeout(() => {
                                            bookingFlow.goBackToDateTimeSelection()
                                                .then(() => {
                                                    // Reset index for time slot selection
                                                    index = 0;
                                                    setTimeout(startBookingProcess, 300);
                                                })
                                                .catch(error => {
                                                    console.error("Failed to navigate back:", error);
                                                    showStatus("❌ Navigation failed!", true);
                                                });
                                        }, 300);
                                        return;
                                    }

                                    // For successful booking or other alerts
                                    console.log("🧪 Alert:", message);
                                };

                                // Now click the book button
                                // bookBtn.click();
                                console.log("✅ Clicked BOOK button");
                                showStatus("⏳ Processing booking request...");

                                // After a delay, if no alert was triggered, consider it a success
                                setTimeout(() => {
                                    // Restore original alert function if it hasn't been restored already
                                    if (window.alert !== originalAlert) {
                                        window.alert = originalAlert;
                                        console.log("✅ BOOKING COMPLETE! 🎉");
                                        showStatus("✅ BOOKING COMPLETE! 🎉");

                                        // Reset attempt counter for future bookings
                                        bookingAttempts = 0;
                                    }
                                }, 1500);
                            } else {
                                console.error("❌ BOOK button not found");
                                showStatus("❌ BOOK button not found!", true);
                                alert("Couldn't find BOOK button. Please complete booking manually.");
                            }
                        },

                        // Helper: Go Back to Date/Time Selection
                        goBackToDateTimeSelection: function () {
                            return new Promise((resolve, reject) => {
                                console.log("🔍 Looking for 'Select date and time' stepper...");

                                // Method 1: Use the exact structure provided
                                const exactStructure = document.querySelector('tr.header td h2.mb0.stepper_title');
                                if (exactStructure && exactStructure.textContent.includes("Select date and time")) {
                                    console.log("✅ Found stepper using exact structure");
                                    const trHeader = exactStructure.closest("tr.header");
                                    trHeader.click();
                                    showStatus("⏪ Going back to date/time selection...");
                                    setTimeout(resolve, 500);
                                    return;
                                }

                                // Method 2: Look for TR with header class
                                const dateTimeStepper = Array.from(document.querySelectorAll("tr.header"))
                                    .find(tr => {
                                        const stepperTitle = tr.querySelector("h2.mb0.stepper_title");
                                        return stepperTitle && stepperTitle.textContent.trim().includes("Select date and time");
                                    });

                                if (dateTimeStepper) {
                                    console.log("✅ Found 'Select date and time' stepper via TR.header");
                                    showStatus("⏪ Going back to date/time selection...");

                                    // Click on the stepper title or the whole row
                                    const clickTarget = dateTimeStepper.querySelector("h2.mb0.stepper_title") || dateTimeStepper;
                                    clickTarget.click();

                                    setTimeout(resolve, 500);
                                    return;
                                }

                                // Method 3: Look directly for stepper title heading
                                const alternativeTarget = document.querySelector("h2.mb0.stepper_title");
                                if (alternativeTarget && alternativeTarget.textContent.includes("Select date and time")) {
                                    console.log("✅ Found 'Select date and time' using alternative selector");
                                    alternativeTarget.click();
                                    showStatus("⏪ Going back to date/time selection...");
                                    setTimeout(resolve, 500);
                                    return;
                                }

                                // Method 4: Try finding by text content (most aggressive approach)
                                const allElements = document.querySelectorAll("*");
                                for (let i = 0; i < allElements.length; i++) {
                                    const elem = allElements[i];
                                    if (elem.textContent &&
                                        elem.textContent.includes("Select date and time") &&
                                        (elem.tagName === "H2" || elem.tagName === "TD" || elem.tagName === "TR")) {
                                        console.log("✅ Found element with 'Select date and time' text:", elem.tagName);

                                        // Try to get to the tr.header
                                        const clickTarget = elem.closest("tr.header") || elem;
                                        clickTarget.click();
                                        showStatus("⏪ Going back to date/time selection...");
                                        setTimeout(resolve, 500);
                                        return;
                                    }
                                }

                                // Last resort: Look for any stepper elements
                                const allSteppers = document.querySelectorAll(".stepper_title");
                                if (allSteppers.length > 0) {
                                    console.log("⚠️ Couldn't find exact stepper, clicking first available stepper");
                                    allSteppers[0].click();
                                    showStatus("⏪ Attempting to navigate back...");
                                    setTimeout(resolve, 500);
                                    return;
                                }

                                // If we get here, we couldn't find any suitable element
                                console.error("❌ Could not find any 'Select date and time' stepper");
                                showStatus("❌ Navigation failed! Please retry manually.", true);
                                reject(new Error("Date/time stepper not found"));
                            });
                        }
                    };

                    // Begin the booking flow with the new day selection step
                    bookingFlow.selectDay();
                }

                // Initialize the booking interface
                createControlPanel();
                console.log("✅ Pickleball booking assistant initialized");
                showStatus("✅ Booking assistant ready");
            }
        });
    });
});