document.getElementById("bookNow").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
                const desiredTimes = ["7-7:30am", "7:30-8am", "8-8:30am", "8:30-9am"];
                const desiredCourt = "PICKLEBALL 4"; // Specific court to select
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
                    if (scheduledTimer) clearTimeout(scheduledTimer);

                    // const targetHour = 14; // Test time (2:45 PM)
                    // const targetMinute = 45;
                    const targetHour = 7; // Production time (7:00 AM)
                    const targetMinute = 0;

                    const { delayMs, formattedTime } = calculateDelayUntilTargetTime(targetHour, targetMinute);

                    console.log(`⏳ Booking scheduled for ${formattedTime}`);
                    showStatus(`⏰ Booking scheduled for ${formattedTime}`);

                    scheduledTimer = setTimeout(() => {
                        console.log(`🚀 Automatic booking triggered!`);
                        showStatus("🚀 Running scheduled booking now...");
                        startBookingProcess();
                    }, delayMs);

                    addCancelButton();
                }

                function addCancelButton() {
                    // Remove existing cancel button if any
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
                        console.log("✅ Found initial Book Now link");
                        bookNowLink.click();
                        console.log("✅ Clicked initial Book Now link");

                        // Wait for the booking page to load before proceeding
                        setTimeout(() => {
                            clickDayButton();
                        }, 900);
                    } else {
                        console.error("❌ Initial Book Now link not found");
                        showStatus("❌ Book Now link not found!", true);
                        alert("Could not find the initial Book Now link.");
                    }
                }

                function clickDayButton() {
                    const today = new Date();
                    const targetDay = new Date(today);
                    targetDay.setDate(today.getDate() + 7);
                    const targetDayNumber = targetDay.getDate().toString();
                    const targetMonth = targetDay.toLocaleString('default', { month: 'short' });

                    console.log(`Looking for ${targetMonth} ${targetDayNumber}`);
                    showStatus(`Looking for ${targetMonth} ${targetDayNumber}...`);

                    // Try to find by day number first
                    const dayButton = Array.from(document.querySelectorAll("button.ui.button.selectable.basic"))
                        .find(button => {
                            const dayNumberDiv = button.querySelector("div.day_number");
                            return dayNumberDiv && dayNumberDiv.textContent.trim() === targetDayNumber && button.offsetParent !== null;
                        });

                    if (dayButton) {
                        dayButton.click();
                        console.log(`✅ Clicked ${targetMonth} ${targetDayNumber}`);
                        showStatus(`✅ Selected ${targetMonth} ${targetDayNumber}`);
                        setTimeout(() => {
                            clickPickleball();
                        }, 500);
                    } else {
                        // Fallback: Try to find by full date text
                        const fullDateButton = Array.from(document.querySelectorAll("button.ui.button.selectable.basic"))
                            .find(button => {
                                const dateText = button.textContent.trim();
                                return dateText.includes(targetMonth) &&
                                    dateText.includes(targetDayNumber) &&
                                    button.offsetParent !== null;
                            });

                        if (fullDateButton) {
                            fullDateButton.click();
                            console.log(`✅ Clicked ${targetMonth} ${targetDayNumber} (fallback)`);
                            showStatus(`✅ Selected ${targetMonth} ${targetDayNumber}`);
                            setTimeout(() => {
                                clickPickleball();
                            }, 500);
                        } else {
                            showStatus(`❌ ${targetMonth} ${targetDayNumber} not found!`, true);
                            alert(`Could not find the button for ${targetMonth} ${targetDayNumber}.`);
                        }
                    }
                }

                function clickPickleball() {
                    const pickleballBtn = Array.from(document.querySelectorAll("button"))
                        .find(btn => btn.textContent.trim().toUpperCase() === "PICKLEBALL");

                    if (pickleballBtn) {
                        pickleballBtn.click();
                        console.log("✅ Clicked Pickleball button");
                        showStatus("✅ Selected Pickleball");
                        setTimeout(() => {
                            clickTimeSlot();
                        }, 500);
                    } else {
                        showStatus("❌ Pickleball button not found!", true);
                        alert("❌ Pickleball button not found.");
                    }
                }

                function clickTimeSlot() {
                    if (index >= desiredTimes.length) {
                        // After all time slots are selected, proceed to court selection
                        console.log("✅ All time slots selected. Proceeding to court selection...");
                        showStatus("✅ All time slots selected. Proceeding to court selection...");

                        setTimeout(() => {
                            selectDesiredCourt(); // Call the court selection function
                        }, 500); // Add a delay before proceeding
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
                        showStatus(`⚠️ Button for "${currentTime}" not found or disabled.`, true);
                    }

                    index++;
                    setTimeout(clickTimeSlot, 400); // Delay before selecting the next time slot
                }

                // IMPROVED COURT SELECTION FUNCTION
                function selectDesiredCourt() {
                    // Create a Map for court priorities
                    // const courtPriorityMap = new Map([
                    //     [0, "PICKLEBALL 2"],
                    //     [1, "PICKLEBALL 4"],
                    //     [2, "PICKLEBALL 8"],
                    //     [3, "PICKLEBALL 9"],
                    //     [4, "PICKLEBALL 3"],
                    //     [5, "PICKLEBALL 6"],
                    //     [6, "PICKLEBALL 7"],
                    //     [7, "PICKLEBALL 1"],
                    //     [8, "PICKLEBALL 5"],
                    //     [9, "PICKLEBALL 10"]
                    // ]);

                    const courtPriorityMap = new Map([
                        [0, "PICKLEBALL 4"],
                        [1, "PICKLEBALL 8"],
                        [2, "PICKLEBALL 9"],
                        [3, "PICKLEBALL 3"],
                        [4, "PICKLEBALL 6"],
                        [5, "PICKLEBALL 7"],
                        [6, "PICKLEBALL 1"],
                        [7, "PICKLEBALL 5"],
                        [8, "PICKLEBALL 10"],
                    ]);

                    console.log("🏟️ Prioritizing courts in this order:", Array.from(courtPriorityMap.values()));

                    showStatus("🏟️ Selecting the best available court...");

                    // Get all available court buttons
                    const courtButtons = Array.from(document.querySelectorAll("button"))
                        .filter(btn => {
                            const btnText = btn.textContent.trim().toUpperCase();
                            // Check if the button text matches any value in the Map
                            return Array.from(courtPriorityMap.values()).includes(btnText) && !btn.disabled && btn.offsetParent !== null;
                        });

                    // Sort the buttons based on the priority defined in the Map
                    courtButtons.sort((a, b) => {
                        const aText = a.textContent.trim().toUpperCase();
                        const bText = b.textContent.trim().toUpperCase();

                        const aPriority = Array.from(courtPriorityMap.values()).indexOf(aText);
                        const bPriority = Array.from(courtPriorityMap.values()).indexOf(bText);

                        return aPriority - bPriority;
                    });

                    if (courtButtons.length > 0) {
                        const selectedCourt = courtButtons[0]; // Pick the highest-priority court
                        const selectedCourtName = selectedCourt.textContent.trim();
                        selectedCourt.click();
                        console.log(`✅ Selected court: ${selectedCourtName}`);
                        showStatus(`✅ Selected court: ${selectedCourtName}`);

                        // Add delay before proceeding to the next step
                        setTimeout(() => {
                            proceedAfterCourtSelection();
                        }, 1000);
                    } else {
                        console.error("❌ No available courts found based on priority.");
                        showStatus("❌ No available courts found!", true);
                        alert("No courts are available based on the priority order. Please select a court manually.");
                    }
                }

                function proceedAfterCourtSelection() {
                    const nextBtn = Array.from(document.querySelectorAll("button"))
                        .find(btn => btn.textContent.trim().toUpperCase() === "NEXT");

                    if (nextBtn) {
                        nextBtn.click();
                        console.log("✅ Clicked NEXT after court selection");
                        showStatus("Proceeding to add users...");

                        setTimeout(() => {
                            addFriendByName();
                        }, 800);
                    } else {
                        showStatus("❌ NEXT button not found!", true);
                        alert("Couldn't proceed after court selection - NEXT button missing");
                    }
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
                    showStatus("👥 Adding users...");

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
                            clickFinalNext();
                        }, 500);
                    }, 1000);
                }

                function clickFinalNext() {
                    const nextBtn = Array.from(document.querySelectorAll("button"))
                        .find(btn => btn.textContent.trim().toUpperCase() === "NEXT");

                    if (nextBtn) {
                        nextBtn.click();
                        console.log("✅ Clicked final NEXT button");
                        showStatus("➡️ Proceeding to book");
                        setTimeout(() => {
                            clickBookButton();
                        }, 1000);
                    } else {
                        showStatus("❌ Final NEXT button not found!", true);
                        alert("Couldn't find final NEXT button.");
                    }
                }

                function clickBookButton() {
                    const bookBtn = Array.from(document.querySelectorAll("button"))
                        .find(btn => btn.textContent.trim().toUpperCase().includes("BOOK"));

                    if (bookBtn) {
                        bookBtn.click();
                        console.log("✅ Clicked BOOK button");
                        showStatus("✅ BOOKING COMPLETE! 🎉");
                        window.alert = function (message) {
                            console.log("🧪 Blocked alert:", message);
                        };
                    } else {
                        showStatus("❌ BOOK button not found!", true);
                        alert("Couldn't find BOOK button.");
                    }
                }

                // Create UI buttons for scheduling or immediate booking
                function createControlPanel() {
                    // Remove existing panel if any
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

                    // Title
                    const title = document.createElement("h3");
                    title.textContent = "Pickleball Booking";
                    title.style.margin = "0 0 10px 0";
                    title.style.padding = "0";
                    panel.appendChild(title);

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
                        if (scheduledTimer) clearTimeout(scheduledTimer);
                        startBookingProcess();
                    });
                    panel.appendChild(bookNowBtn);

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
                    scheduleBtn.addEventListener("click", scheduleBooking);
                    panel.appendChild(scheduleBtn);

                    document.body.appendChild(panel);
                }

                createControlPanel();
            }
        });
    });
});