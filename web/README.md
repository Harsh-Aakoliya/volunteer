# Volunteer Web Application

A Next.js web application with authentication functionality using Zustand for state management and Tailwind CSS for styling.

## Features

- User authentication (Login & Signup)
- Zustand for state management with persistent storage
- Tailwind CSS for modern, responsive styling
- Protected routes and dashboard
- Integration with the shared backend API

## Setup

### Prerequisites

- Node.js 18+ installed
- Backend server running (see Backend folder)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root of the `web` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

Update the API URL to match your backend server address.

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Build

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Authentication Flow

### Signup
1. User fills in:
   - Full Name
   - Mobile Number
   - User ID (Specific ID)
2. Registration request is sent to the backend
3. User is redirected to login page
4. Admin approval is required before login

### Login
1. User enters:
   - Mobile Number
   - Password (set by admin during approval, typically same as mobile number)
2. On successful login, user is redirected to dashboard
3. User data and token are stored in Zustand (persisted in localStorage)

### Dashboard
- Displays user information
- Shows user role (HOD or Sevak)
- Lists user departments
- Logout functionality

## API Endpoints Used

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/users/:userId/profile` - Get user profile (protected)

## Technology Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Zustand** - State management
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client

## Project Structure

```
web/
├── app/
│   ├── login/          # Login page
│   ├── signup/         # Signup page
│   ├── dashboard/      # Protected dashboard
│   └── page.tsx        # Root page (redirects)
├── store/
│   └── authStore.ts    # Zustand auth store
├── lib/
│   └── api.ts          # API utilities
└── README.md
```
