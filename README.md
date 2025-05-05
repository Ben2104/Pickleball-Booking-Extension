# Pickleball-Booking-Extension


https://github.com/user-attachments/assets/53b3babd-3a33-48c9-a414-72785844e8a1

# 🏓 Pickleball Reservation Extension

A Chrome Extension that automates the court booking process at iPickle Cerritos. Designed to handle the high demand and fast-paced reservation system by automatically booking courts as soon as they become available — **7 days in advance at 7:00 AM**.


## 🚀 Motivation

Because of the **high demand** for court reservations at **iPickle Cerritos**, it’s extremely competitive to book a slot as soon as it opens up—**7 days in advance**. This extension streamlines the process, saving time and increasing your chances of securing a court.Ï
## 📌 Features

- ⏰ **Auto-booking**: Automatically attempts to reserve your preferred court at exactly 7:00 AM each morning.
- 📅 **Schedule Button**: Manually schedule a booking attempt with a single click.
- 🥇 **Smart Court Selection**: Books courts based on a **quality priority system**—trying the best courts first.
- ✅ **One-Time Try**: Will not retry after the first attempt—ensuring no duplicate or excessive requests.
- 🔔 **Confirmation Notification**: Get a message once a booking is successfully made.

## 🎯 Court Priority Logic

The extension uses a built-in court priority map based on user experience and court quality. It tries to reserve the best courts first, in this order:

1. PICKLEBALL 2  
2. PICKLEBALL 4  
3. PICKLEBALL 8  
4. PICKLEBALL 9  
5. PICKLEBALL 3  
6. PICKLEBALL 6  
7. PICKLEBALL 7  
8. PICKLEBALL 1  
9. PICKLEBALL 5  
10. PICKLEBALL 10


## 🛠️ How to Use

1. Clone or download the repository.
2. Load it as an **unpacked extension** in Chrome:
   - Go to `chrome://extensions/`
   - Enable **Developer Mode**
   - Click **Load unpacked**
   - Select the extension folder
3. Set your preferences (e.g. time, court)
4. Let it auto-book, or click the **Schedule** button manually.

## 🔒 Disclaimer

This tool is intended for **personal use only** and should be used responsibly. It does not bypass any security or fair usage rules set by iPickle Cerritos.

---
