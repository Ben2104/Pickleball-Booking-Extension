document.getElementById("bookNow").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
                const desiredTimes = ["7-7:30am", "7:30-8am", "8-8:30am", "8:30-9am"];
                let index = 0;
                let scheduledTimer = null;
                const targetHour = 16; // Production time (7:00 AM)
                const targetMinute = 42;

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

                function scheduleBooking() {
                    if (scheduledTimer) clearTimeout(scheduledTimer);
                
                    console.log(`⏳ Booking scheduled for ${targetHour}:${targetMinute}`);
                    showStatus(`⏰ Booking scheduled for ${targetHour}:${targetMinute}`);
                
                    const delayMs = 1000 * 10; // 10 seconds for testing
                
                    scheduledTimer = setTimeout(() => {
                        console.log(`🚀 Automatic booking triggered!`);
                        showStatus("🚀 Running scheduled booking now...");
                        startBookingProcess();
                    }, delayMs);
                
                    console.log("✅ Timer set for scheduled booking");
                    addCancelButton();
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
                            showStatus("Scheduled booking cancelled", true);
                            cancelBtn.remove();
                        }
                    });

                    document.body.appendChild(cancelBtn);
                }

                function startBookingProcess() {
                    console.log("🚀 Starting booking automation");
                    clickDay(); // Start by selecting the day 7 days from now
                }

                function clickDay() {
                    // Get the target date (7 days from today)
                    const today = new Date();
                    const nextWeek = new Date(today);
                    nextWeek.setDate(today.getDate() + 7);
                
                    // Format the day name and day number
                    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
                    const dayName = dayNames[nextWeek.getDay()]; // e.g., "TUE"
                    const dayNumber = nextWeek.getDate().toString(); // e.g., "29"
                
                    console.log(`🗓️ Looking for button with day: ${dayName} and number: ${dayNumber}`);
                    showStatus(`Looking for date: ${dayName} ${dayNumber}...`);
                
                    // Find the button with matching day name and day number
                    const dateButton = Array.from(document.querySelectorAll("button.ui.button.selectable.basic"))
                        .find(button => {
                            const dayNameDiv = button.querySelector("div.day_name");
                            const dayNumberDiv = button.querySelector("div.day_number");
                
                            return (
                                dayNameDiv &&
                                dayNumberDiv &&
                                dayNameDiv.textContent.trim().toUpperCase() === dayName &&
                                dayNumberDiv.textContent.trim() === dayNumber &&
                                button.offsetParent !== null // Ensure the button is visible
                            );
                        });
                
                    if (dateButton) {
                        dateButton.click();
                        console.log(`✅ Selected date: ${dayName} ${dayNumber}`);
                        showStatus(`✅ Selected date: ${dayName} ${dayNumber}`);
                        setTimeout(() => {
                            clickPickleball();
                        }, 300);
                    } else {
                        console.error(`❌ Button for ${dayName} ${dayNumber} not found.`);
                        showStatus(`❌ ${dayName} ${dayNumber} not found!`, true);
                    }
                }

                function clickPickleball() {
                    const pickleballBtn = Array.from(document.querySelectorAll("button"))
                        .find(btn => btn.textContent.trim().toUpperCase() === "PICKLEBALL");

                    if (pickleballBtn) {
                        pickleballBtn.click();
                        console.log("✅ Clicked Pickleball button");
                        showStatus(" Selected Pickleball");
                        setTimeout(() => {
                            clickTimeSlot();
                        }, 50);
                    } else {
                        showStatus(" Pickleball button not found!", true);
                        alert(" Pickleball button not found.");
                    }
                }

                function clickTimeSlot() {
                    if (index >= desiredTimes.length) {
                        console.log("✅ All time slots selected. Proceeding to court selection...");
                        showStatus(" All time slots selected. Proceeding to court selection...");

                        setTimeout(() => {
                            selectDesiredCourt();
                        }, 50);
                        return;
                    }

                    const buttons = Array.from(document.querySelectorAll("button"));
                    const currentTime = desiredTimes[index];
                    const button = buttons.find(b => b.textContent.trim() === currentTime);

                    if (button && !button.disabled) {
                        button.click();
                        console.log(`✅ Clicked ${currentTime}`);
                        showStatus(` Trying time: ${currentTime}`);
                    } else {
                        console.warn(`⚠️ Button for "${currentTime}" not found or disabled.`);
                        showStatus(` Button for "${currentTime}" not found or disabled.`, true);
                    }

                    index++;
                    setTimeout(clickTimeSlot, 100);
                }

                function selectDesiredCourt() {
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
                        [9, "PICKLEBALL 2"],
                    ]);

                    console.log("🏟️ Prioritizing courts in this order:", Array.from(courtPriorityMap.values()));

                    showStatus(" Selecting the best available court...");

                    const courtButtons = Array.from(document.querySelectorAll("button"))
                        .filter(btn => {
                            const btnText = btn.textContent.trim().toUpperCase();
                            return Array.from(courtPriorityMap.values()).includes(btnText) && !btn.disabled && btn.offsetParent !== null;
                        });

                    courtButtons.sort((a, b) => {
                        const aText = a.textContent.trim().toUpperCase();
                        const bText = b.textContent.trim().toUpperCase();

                        const aPriority = Array.from(courtPriorityMap.values()).indexOf(aText);
                        const bPriority = Array.from(courtPriorityMap.values()).indexOf(bText);

                        return aPriority - bPriority;
                    });

                    if (courtButtons.length > 0) {
                        const selectedCourt = courtButtons[0];
                        const selectedCourtName = selectedCourt.textContent.trim();
                        selectedCourt.click();
                        console.log(`✅ Selected court: ${selectedCourtName}`);
                        showStatus(` Selected court: ${selectedCourtName}`);

                        setTimeout(() => {
                            proceedAfterCourtSelection();
                        }, 200);
                    } else {
                        console.error("❌ No available courts found based on priority.");
                        showStatus(" No available courts found!", true);
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
                        }, 100);
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
                        showStatus(" Users added");

                        setTimeout(() => {
                            clickFinalNext();
                        }, 600);
                    }, 500);
                }

                function clickFinalNext() {
                    const nextBtn = Array.from(document.querySelectorAll("button"))
                        .find(btn => btn.textContent.trim().toUpperCase() === "NEXT");

                    if (nextBtn) {
                        nextBtn.click();
                        console.log("✅ Clicked final NEXT button");
                        showStatus(" Proceeding to book");
                        setTimeout(() => {
                            clickBookButton();
                        }, 200);
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
                        showStatus(" BOOKING COMPLETE!");
                        window.alert = function (message) {
                            console.log("🧪 Blocked alert:", message);
                        };
                    } else {
                        showStatus("❌ BOOK button not found!", true);
                        alert("Couldn't find BOOK button.");
                    }
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