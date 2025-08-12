const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const path = require("path");

// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Web Reporting 2.0 API",
    version: "1.0.0",
    description: "API documentation for Web Reporting 2.0",
  },
  servers: [
    {
      url: "http://localhost:3000/api",
      description: "API server",
    },
    {
      url: "http://localhost:3000/docs",
      description: "Swagger Documentation",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

// Options for swagger-jsdoc
const options = {
  swaggerDefinition,
  // Path to the API docs
  apis: [
    path.join(__dirname, "../routes/*.js"),
    path.join(__dirname, "../models/*.js"),
    path.join(__dirname, "../controllers/*.js"),
    path.join(__dirname, "../modules/*/*.routes.js"),
  ],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = {
  swaggerUi,
  swaggerSpec,
};
