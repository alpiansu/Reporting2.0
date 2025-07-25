# Web Reporting 2.0 - Backend API

This is the backend API for the Web Reporting 2.0 application, a comprehensive reporting and store screening tool.

## Features

- User authentication and authorization
- Store management
- Database screening and analysis
- Report generation
- Real-time screening progress tracking

## Tech Stack

- Node.js
- Express.js
- MySQL (via Sequelize ORM)
- JWT Authentication
- Winston Logger

## Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Request controllers
├── middlewares/    # Express middlewares
├── models/         # Sequelize models
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Utility functions
├── database/       # Database migrations and seeders
├── app.js          # Express app setup
└── server.js       # Server entry point
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MySQL (v8 or higher)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   # Server
   PORT=3001
   NODE_ENV=development

   # JWT
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRATION=24h

   # Database
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=web_reporting

   # Logging
   LOG_LEVEL=info
   ```

4. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/refresh-token` - Refresh JWT token

### Stores

- `GET /api/stores` - Get all stores
- `GET /api/stores/:id` - Get store by ID
- `POST /api/stores` - Create a new store
- `PUT /api/stores/:id` - Update store
- `DELETE /api/stores/:id` - Delete store
- `POST /api/stores/test-connection` - Test store database connection

### Screenings

- `GET /api/screenings` - Get all screenings
- `GET /api/screenings/:id` - Get screening by ID
- `POST /api/screenings` - Start a new screening
- `GET /api/screenings/:id/progress` - Get screening progress
- `POST /api/screenings/:id/cancel` - Cancel a screening
- `GET /api/screenings/statistics` - Get screening statistics

## License

ISC