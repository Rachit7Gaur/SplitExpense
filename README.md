### EquiSplit — Shared Expenses, Simplified

**EquiSplit** is a collaborative expense management web application that helps users manage shared expenses with friends, family, and groups. Users can create groups, record expenses, track balances, and view settlement suggestions through a simple web interface.

## Live Application

- **Frontend:** https://equisplit-pied-chi.vercel.app
- **Backend API:** https://splitexpense-backend.onrender.com
- **GitHub Repository:** https://github.com/Rachit7Gaur/SplitExpense

## Features

- User authentication with email/password, Google, and phone authentication
- Email verification
- Create and manage expense groups
- Invite members to groups using invite links
- Add expenses and split them among group members
- View group expense history
- Track who owes whom
- Generate settlement suggestions
- Manage account settings and linked authentication providers
- Save and manage UPI payment profiles
- Submit and verify payment references for settlements

## Technology Stack

**Frontend**
- React
- Vite
- CSS

**Backend**
- Node.js
- Express.js
- MongoDB
- Mongoose

**Authentication**
- Firebase Authentication
- Firebase Admin SDK

**Database**
- MongoDB Atlas

**Deployment**
- Vercel — Frontend hosting
- Render — Backend hosting

**Version Control**
- Git
- GitHub

## Project Architecture

The application follows a client-server architecture.

1. The React frontend provides the user interface.
2. The Express backend handles API requests and application logic.
3. Firebase Authentication manages user authentication.
4. Firebase Admin SDK verifies authentication tokens on the backend.
5. MongoDB Atlas stores application data.
6. The frontend communicates with the backend through REST APIs.

## Project Structure

```text
SplitExpense/
├── client/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── pages/
│       └── services/
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   └── routes/
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js
- npm
- MongoDB Atlas account
- Firebase project

### 1. Clone the repository

```bash
git clone https://github.com/Rachit7Gaur/SplitExpense.git
cd SplitExpense
```

### 2. Install frontend dependencies

```bash
cd client
npm install
```

### 3. Install backend dependencies

Open another terminal:

```bash
cd server
npm install
```

### 4. Configure environment variables

Create the required `.env` files for the frontend and backend.

Use the environment variable names defined in the project's configuration files.

Never commit real API keys, passwords, Firebase service-account files, or other secrets.

### 5. Run the application

Start the backend and frontend in separate terminals using their respective development scripts.

For example:

```bash
# Backend
cd server
npm run dev
```

```bash
# Frontend
cd client
npm run dev
```

Check the `package.json` files for the exact scripts available in your project.

## Deployment

EquiSplit is deployed using:

- **Vercel:** Hosts the React frontend.
- **Render:** Hosts the Node.js and Express backend.
- **MongoDB Atlas:** Provides cloud database hosting.

The deployed frontend communicates with the backend API hosted on Render.

## Development Team

This project is being developed collaboratively by a team of three members.

## Project Status

The application has been deployed, with core authentication, group management, expense tracking, balance calculations, settlement suggestions, and account settings implemented.

Further improvements, testing, and maintenance are part of ongoing development.

---

**SplitExpense — EquiSplit**

*Less calculating. More living.*
