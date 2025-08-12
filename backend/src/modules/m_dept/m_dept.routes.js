/**
 * Routes for m_dept
 */
const express = require("express");
const MDeptController = require("./m_dept.controller");
const MDeptService = require("./m_dept.service");
const { authenticateJWT } = require("../../middlewares");
const multer = require("multer");
const path = require("path");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../../uploads/temp"));
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

// Create service instance
const mDeptService = new MDeptService();
// Create controller with service dependency
const mDeptController = new MDeptController(mDeptService);
const router = express.Router();

// Protect all routes with authentication
router.use(authenticateJWT);

/**
 * @swagger
 * tags:
 *   name: MDept
 *   description: Department data management
 */

/**
 * @swagger
 * /m-dept:
 *   get:
 *     summary: Get all departments
 *     description: Retrieve a list of all departments
 *     tags: [MDept]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of departments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MDept'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", mDeptController.getAllDepartments.bind(mDeptController));

/**
 * @swagger
 * /m-dept:
 *   post:
 *     summary: Create a new department
 *     description: Create a new department record
 *     tags: [MDept]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dep_kd
 *               - dep_nm
 *               - div_kd
 *             properties:
 *               dep_kd:
 *                 type: string
 *                 description: Department code
 *               dep_nm:
 *                 type: string
 *                 description: Department name
 *               div_kd:
 *                 type: string
 *                 description: Division code
 *               dep_mgr:
 *                 type: string
 *                 description: Department manager
 *     responses:
 *       201:
 *         description: Department created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", mDeptController.createDepartment.bind(mDeptController));

/**
 * @swagger
 * /m-dept/{dep_kd}:
 *   put:
 *     summary: Update a department
 *     description: Update an existing department record
 *     tags: [MDept]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dep_kd
 *         required: true
 *         schema:
 *           type: string
 *         description: Department code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dep_nm:
 *                 type: string
 *                 description: Department name
 *               div_kd:
 *                 type: string
 *                 description: Division code
 *               dep_mgr:
 *                 type: string
 *                 description: Department manager
 *     responses:
 *       200:
 *         description: Department updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Department not found
 *       500:
 *         description: Server error
 */
router.put("/:dep_kd", mDeptController.updateDepartment.bind(mDeptController));

/**
 * @swagger
 * /m-dept/upload:
 *   post:
 *     summary: Upload departments from file
 *     description: Upload and process a CSV file containing department data
 *     tags: [MDept]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         description: CSV file with department data
 *     responses:
 *       200:
 *         description: Departments uploaded successfully
 *       400:
 *         description: No file uploaded or invalid file format
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/upload", upload.single("file"), mDeptController.uploadDepartments.bind(mDeptController));

module.exports = router;