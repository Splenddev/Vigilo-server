# 📘 Vigilo Attendance App Server

Welcome to the **Vigilo Attendance Server**, the backend powerhouse of a modern attendance management solution crafted for academic institutions. This Node.js + Express.js server offers a robust, flexible, and efficient API suite to manage student check-ins, absence pleas, schedules, attendance statistics, and more — with role-based access control for Class Representatives and Students.

---

## ✨ Why Vigilo?

In an era where digital presence matters, **Vigilo** (Latin for *"watch"*) ensures academic attendance is no longer bound by paper or flawed memory. With smart tracking, geolocation, and real-time control, it helps institutions:

- ✅ Prevent impersonation and proxy attendance.
- ⏰ Monitor punctuality and participation accurately.
- 📊 Review and visualize attendance history in detail.
- 📍 Use geofencing to verify physical presence.
- 🙏 Handle absence pleas with proof-based moderation.
- 🛡️ Maintain control over attendance records through class leadership.

---

## 🏗️ Tech Stack

- **Node.js** (v18+)
- **Express.js**
- **MongoDB + Mongoose**
- **JWT Authentication**
- **Cloudinary / Local storage** for media
- **Framer Motion-ready endpoints** for animation-based frontend
- **Geolocation & Timezone-aware tracking**
- **Cron Jobs** for cleanup and automation

---

## ⚙️ How the App Works

### 🎭 Roles
- **Student**
  - Joins a group (class).
  - Marks attendance based on real-time class sessions.
  - Submits absence pleas with evidence.
  - Views attendance history and class media.

- **Class Representative**
  - Creates and manages class groups.
  - Initiates and controls attendance sessions.
  - Reviews and approves pleas.
  - Posts announcements and class resources.
  - Uploads and verifies class media.

### 🔁 Daily Attendance Flow
1. **Class Rep** creates attendance session (with timing, rules, and geolocation).
2. **Students** mark their attendance using:
   - Real-time clock sync.
   - Geolocation proximity.
   - Optional check-out feature.
3. Session automatically **closes via cron job**, or manually by Rep.
4. Students can submit **absence pleas**, with image/PDF/video as proof.
5. Reps **review & decide** on plea outcomes.
6. Summary stats update attendance records for the session.

---

## 📦 Project Structure
├── controllers/ 
│   ├── authController.js 
│   ├── attendanceController.js 
│   └── pleaController.js 
├── models/ 
│   ├── User.js 
│   ├── Group.js 
│   └── Attendance.js 
├── routes/ 
│   ├── authRoutes.js 
│   ├── groupRoutes.js 
│   └── attendanceRoutes.js 
├── utils/ 
│   ├── validators/ 
│   ├── geoUtils.js 
│   └── timeUtils.js 
├── middlewares/ 
│   ├── authMiddleware.js 
│   └── errorHandler.js 
├── config/ 
├── jobs/ 
│   └── cronFinalizer.js 
└── server.js

---

## 🔐 Authentication

- Uses **JWT tokens** for session handling.
- Access to certain endpoints is protected by role-specific middleware.
- All attendance actions are tied to authenticated users only.

---

## 🧠 Noteworthy Features

- 🌍 **Timezone-aware** class sessions — no more confusion across time zones.
- 🛰️ **Geofencing** — accurate verification of physical presence.
- ♻️ **Reopen Sessions** — with controls like re-check-in limits and late check-in toggles.
- 🔁 **Recurring Schedules** — support for weekly or daily recurring classes.
- 📤 **Proof Uploads** — images, docs, or videos as evidence of valid absence.
- 📉 **Analytics-ready summaries** — top absentees, check-in times, and plea rates.
- 🛑 **Auto-mark absent** — for students who didn’t check-in before deadline.

---

