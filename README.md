# SplitExpense

### EquiSplit — Shared Expenses, Simplified

SplitExpense is a collaborative expense management web application that helps users create groups, record shared expenses, track balances, and calculate settlements.

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

**Version Control**
- Git
- GitHub

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

Use the environment variable names defined in the project's configuration files. Never commit real API keys, passwords, Firebase service-account files, or other secrets.

### 5. Run the application

Start the backend and frontend in separate terminals using their respective development scripts.

## Development Team

This project is being developed collaboratively by a team of three.

## Project Status

Core authentication, group management, expense tracking, balance calculations, settlement suggestions, and account settings are implemented. Additional features and production deployment are part of ongoing development.

---

**SplitExpense — EquiSplit**  
*Less calculating. More living.*