document.getElementById("bookNow").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
                const desiredTimes = ["7-7:30am", "7:30-8am", "8-8:30am", "8:30-9am"];
                let index = 0;
                let scheduledTimer = null;

                // Show a status message on the page
                function showStatus(message, isError = false) {
                    // Create status container if it doesn't exist
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

                // Calculate the delay until target time
                function calculateDelayUntilTargetTime(hours, minutes) {
                    const now = new Date();
                    let targetTime = new Date(now);
                    targetTime.setHours(hours, minutes, 0, 0);

                    // If it's already past the target time today, set it for tomorrow
                    if (now > targetTime) {
                        targetTime.setDate(targetTime.getDate() + 1);
                    }

                    return {
                        delayMs: targetTime - now,
                        formattedTime: targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    };
                }

                // Schedule the booking process
                function scheduleBooking() {
                    // Cancel any existing scheduled booking
                    if (scheduledTimer) {
                        clearTimeout(scheduledTimer);
                    }

                    // For testing use 14:45 (2:45 PM)
                    const targetHour = 14;
                    const targetMinute = 45;

                    // For production use 7:00 AM
                    // const targetHour = 7;
                    // const targetMinute = 0;

                    const { delayMs, formattedTime } = calculateDelayUntilTargetTime(targetHour, targetMinute);

                    console.log(`⏳ Booking scheduled for ${formattedTime} (${Math.round(delayMs / 1000 / 60)} minutes from now)`);
                    showStatus(`⏰ Booking scheduled for ${formattedTime}`);

                    // Set the timer to trigger the booking process
                    scheduledTimer = setTimeout(() => {
                        console.log(`🚀 Automatic booking triggered at scheduled time!`);
                        showStatus("🚀 Running scheduled booking now...");
                        startBookingProcess();
                    }, delayMs);

                    // Add a cancel button
                    addCancelButton();
                }

                // Add a button to cancel scheduled booking
                function addCancelButton() {
                    // Remove existing cancel button if any
                    const existingBtn = document.getElementById("cancel-scheduled-booking");
                    if (existingBtn) {
                        existingBtn.remove();
                    }

                    // Create cancel button
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

                // Start the booking process
                function startBookingProcess() {
                    console.log("🚀 Starting booking automation");
                    clickBookNowButton();
                }

                function clickBookNowButton() {
                    // First, try to find the Book Now link with the specific HTML structure
                    const bookNowLinks = Array.from(document.querySelectorAll("a.ui.button.large.fluid.white"));
                    const bookNowLink = bookNowLinks.find(link => {
                        const span = link.querySelector("span.text.bold.green");
                        return span && span.textContent.trim().toUpperCase().includes("BOOK NOW");
                    });

                    if (bookNowLink) {
                        console.log("✅ Found initial Book Now link:", bookNowLink);
                        bookNowLink.click();
                        console.log("✅ Clicked initial Book Now link");

                        // Wait for the booking page to load before proceeding
                        setTimeout(() => {
                            clickDayButton();
                        }, 2000); // Longer delay for page navigation
                    } else {
                        console.error("❌ Initial Book Now link not found");
                        showStatus("❌ Book Now link not found!", true);
                        alert("Could not find the initial Book Now link. Make sure you're on the correct page.");
                    }
                }

                function clickPickleball() {
                    const pickleballBtn = Array.from(document.querySelectorAll("button"))
                        .find(btn => btn.textContent.trim().toUpperCase() === "PICKLEBALL");

                    if (pickleballBtn) {
                        pickleballBtn.click();
                        console.log("✅ Clicked Pickleball button");
                        showStatus("✅ Selected Pickleball");

                        // Add delay before continuing to time slot selection
                        setTimeout(() => {
                            clickTimeSlot();
                        }, 1000);
                    } else {
                        showStatus("❌ Pickleball button not found!", true);
                        alert("❌ Pickleball button not found.");
                    }
                }

                function clickDayButton() {
                    const today = new Date();
                    const targetDay = new Date(today);
                    targetDay.setDate(today.getDate() + 7); // Add 7 days to today's date
                    const targetDayText = targetDay.getDate().toString();

                    console.log(`Looking for date button with day: ${targetDayText}`);
                    showStatus(`Looking for day ${targetDayText}...`);

                    const dayButton = Array.from(document.querySelectorAll("button.ui.button.selectable.basic"))
                        .find(button => {
                            const dayNumberDiv = button.querySelector("div.day_number");
                            return dayNumberDiv && dayNumberDiv.textContent.trim() === targetDayText && button.offsetParent !== null;
                        });

                    console.log("Found day button:", dayButton);

                    if (dayButton) {
                        dayButton.click();
                        console.log(`✅ Clicked button for day ${targetDayText}`);
                        showStatus(`✅ Selected day ${targetDayText}`);

                        // Add delay before proceeding to the next step
                        setTimeout(() => {
                            clickPickleball();
                        }, 1000);
                    } else {
                        console.error(`❌ Button for day ${targetDayText} not found.`);
                        showStatus(`❌ Day ${targetDayText} not found!`, true);
                        alert(`Button for day ${targetDayText} not found. Make sure you're on the correct page.`);
                    }
                }

                function clickTimeSlot() {
                    if (index >= desiredTimes.length) {
                        const nextBtn = Array.from(document.querySelectorAll("button"))
                            .find(btn => btn.textContent.trim().toUpperCase() === "NEXT");

                        if (nextBtn) {
                            nextBtn.click();
                            console.log("✅ Clicked NEXT after time selection");
                            showStatus("✅ Selected time slot");

                            // Wait for next screen to load before adding friend
                            setTimeout(() => {
                                addFriendByName();
                            }, 1500);
                        } else {
                            showStatus("❌ NEXT button not found!", true);
                            alert("❌ NEXT button not found after time selection.");
                        }
                        return;
                    }

                    const buttons = Array.from(document.querySelectorAll("button"));
                    const currentTime = desiredTimes[index];
                    const button = buttons.find(b => b.textContent.trim() === currentTime);

                    if (button && !button.disabled) {
                        button.click();
                        console.log(`✅ Clicked ${currentTime}`);
                        showStatus(`✅ Trying time: ${currentTime}`);
                    } else {
                        console.warn(`⚠️ Button for "${currentTime}" not found or disabled.`);
                    }

                    index++;
                    setTimeout(clickTimeSlot, 400);
                }

                function addFriendByName() {
                    const openAddUsersBtn = Array.from(document.querySelectorAll("button"))
                        .find(btn => btn.textContent.trim().toUpperCase() === "ADD USERS");

                    if (!openAddUsersBtn) {
                        showStatus("❌ ADD USERS button not found!", true);
                        alert("❌ 'ADD USERS' button not found.");
                        return;
                    }

                    openAddUsersBtn.click();
                    console.log("✅ Clicked 'ADD USERS'");
                    showStatus("✅ Adding users...");

                    setTimeout(() => {
                        const addBtn = Array.from(document.querySelectorAll("button"))
                            .find(btn => btn.textContent.trim().toUpperCase() === "ADD");

                        if (!addBtn) {
                            showStatus("❌ ADD button not found!", true);
                            alert("❌ 'ADD' button not found in modal.");
                            return;
                        }

                        addBtn.click();
                        console.log("✅ Clicked 'ADD' in modal");
                        showStatus("✅ Users added");

                        // Try FINAL NEXT button after a pause
                        setTimeout(() => {
                            tryClickNextButton(15);
                        }, 1000);
                    }, 1500);
                }

                function tryClickNextButton(retries) {
                    console.log(`Attempting to find final NEXT button (${retries} retries left)`);
                    showStatus("Looking for final NEXT button...");

                    setTimeout(() => {
                        // Try multiple selector strategies
                        const nextBtnCandidates = [
                            // Strategy 1: Buttons with text "NEXT"
                            ...Array.from(document.querySelectorAll("button")).filter(btn =>
                                btn.textContent.trim().toUpperCase() === "NEXT" &&
                                btn.offsetParent !== null
                            ),

                            // Strategy 2: Any element with "NEXT" that looks clickable
                            ...Array.from(document.querySelectorAll("div, span, a")).filter(el =>
                                el.textContent.trim().toUpperCase() === "NEXT" &&
                                el.offsetParent !== null &&
                                (el.onclick || el.getAttribute("role") === "button")
                            )
                        ];

                        console.log(`Found ${nextBtnCandidates.length} potential NEXT buttons`);

                        if (nextBtnCandidates.length > 0) {
                            const nextBtn = nextBtnCandidates[0];
                            console.log("✅ Attempting to click NEXT button:", nextBtn);
                            showStatus("✅ Clicking final NEXT button");

                            // Try multiple click methods
                            try {
                                // Method 1: Normal click
                                nextBtn.click();

                                // Method 2: MouseEvent
                                nextBtn.dispatchEvent(new MouseEvent("click", {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window
                                }));

                                console.log("Click attempts complete");

                                // After clicking NEXT, try to find and click the BOOK button
                                setTimeout(() => {
                                    tryClickBookButton(15);
                                }, 1500);

                            } catch (e) {
                                console.error("Error clicking button:", e);
                                if (retries > 0) {
                                    tryClickNextButton(retries - 1);
                                }
                            }
                        } else if (retries > 0) {
                            console.log("⏳ Retrying NEXT button in 800ms...");
                            // Increase delay between retries
                            setTimeout(() => {
                                tryClickNextButton(retries - 1);
                            }, 800);
                        } else {
                            console.warn("❌ Gave up trying to click 'NEXT'.");
                            showStatus("❌ Couldn't find NEXT button", true);
                            alert("Couldn't find the final NEXT button after multiple attempts.");
                        }
                    }, 800); // Increased delay
                }

                function tryClickBookButton(retries) {
                    console.log(`Attempting to find BOOK button (${retries} retries left)`);
                    showStatus("Looking for BOOK button...");

                    // Try multiple selector strategies for the BOOK button
                    const bookBtnCandidates = [
                        // Strategy 1: Buttons with text "BOOK"
                        ...Array.from(document.querySelectorAll("button")).filter(btn =>
                            btn.textContent.trim().toUpperCase() === "BOOK" &&
                            btn.offsetParent !== null
                        ),

                        // Strategy 2: Any element with "BOOK" that looks clickable
                        ...Array.from(document.querySelectorAll("div, span, a")).filter(el =>
                            el.textContent.trim().toUpperCase() === "BOOK" &&
                            el.offsetParent !== null &&
                            (el.onclick || el.getAttribute("role") === "button")
                        ),

                        // Strategy 3: Buttons with text containing "BOOK NOW" or similar
                        ...Array.from(document.querySelectorAll("button")).filter(btn =>
                            (btn.textContent.trim().toUpperCase().includes("BOOK") ||
                                btn.textContent.trim().toUpperCase().includes("CONFIRM") ||
                                btn.textContent.trim().toUpperCase().includes("RESERVE")) &&
                            btn.offsetParent !== null
                        )
                    ];

                    console.log(`Found ${bookBtnCandidates.length} potential BOOK buttons`);

                    if (bookBtnCandidates.length > 0) {
                        const bookBtn = bookBtnCandidates[0];
                        console.log("✅ Attempting to click BOOK button:", bookBtn);
                        showStatus("✅ Clicking BOOK button");

                        try {
                            // Method 1: Normal click
                            bookBtn.click();

                            // Method 2: MouseEvent
                            bookBtn.dispatchEvent(new MouseEvent("click", {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            }));

                            console.log("✅ Booking complete!");
                            showStatus("✅ BOOKING COMPLETE! 🎉", false);
                            setTimeout(() => {
                                alert("✅ Booking has been completed successfully!");
                            }, 1000);
                            window.alert = function (message) {
                                console.log("🧪 Blocked alert:", message);
                            };

                        } catch (e) {
                            console.error("Error clicking BOOK button:", e);
                            if (retries > 0) {
                                setTimeout(() => {
                                    tryClickBookButton(retries - 1);
                                }, 800);
                            }
                        }
                    } else if (retries > 0) {
                        console.log("⏳ Retrying BOOK button in 800ms...");
                        setTimeout(() => {
                            tryClickBookButton(retries - 1);
                        }, 800);
                    } else {
                        console.warn("❌ Gave up trying to click 'BOOK' button.");
                        showStatus("❌ Couldn't find BOOK button", true);
                        alert("Almost there! Found the NEXT button but couldn't find the final BOOK button. You may need to complete this step manually.");
                    }
                }

                // Create UI buttons for scheduling or immediate booking
                function createControlPanel() {
                    // Remove existing panel if any
                    const existingPanel = document.getElementById("booking-control-panel");
                    if (existingPanel) {
                        existingPanel.remove();
                    }

                    // Create panel
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

                    // Title
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
                        // Cancel any scheduled booking
                        if (scheduledTimer) {
                            clearTimeout(scheduledTimer);
                            scheduledTimer = null;
                        }
                        // Start booking immediately
                        startBookingProcess();
                    });
                    panel.appendChild(bookNowBtn);

                    // Schedule button
                    const scheduleBtn = document.createElement("button");
                    scheduleBtn.textContent = "Schedule for 7 AM";
                    scheduleBtn.style.display = "block";
                    scheduleBtn.style.width = "100%";
                    scheduleBtn.style.padding = "8px";
                    scheduleBtn.style.backgroundColor = "#2196F3";
                    scheduleBtn.style.color = "white";
                    scheduleBtn.style.border = "none";
                    scheduleBtn.style.borderRadius = "5px";
                    scheduleBtn.style.cursor = "pointer";
                    scheduleBtn.addEventListener("click", () => {
                        scheduleBooking();
                    });
                    panel.appendChild(scheduleBtn);

                    document.body.appendChild(panel);
                }

                // Create the control panel
                createControlPanel();
            }
        });
    });
});