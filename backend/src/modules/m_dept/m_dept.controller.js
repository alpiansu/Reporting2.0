/**
 * Controller for m_dept data
 */
import logger from '../../config/logger.js';
import { apiResponse } from '../../utils/index.js';
import mDeptService from './m_dept.service.js';

// Initialize service
const service = new mDeptService();

/**
 * Get all departments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const getAllDepartments = async (req, res, next) => {
  try {
    const departments = await service.getAllDepartments();
    
    return res.status(200).json({
      success: true,
      data: departments
    });
  } catch (error) {
    logger.error(`Error in getAllDepartments: ${error.message}`);
    next(error);
  }
};

/**
 * Create a new department
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const createDepartment = async (req, res, next) => {
  try {
    const departmentData = req.body;
    
    if (!departmentData.kddept || !departmentData.namadept) {
      return apiResponse.badRequest(res, "Department code (kddept) and name (namadept) are required");
    }
    
    const department = await service.createDepartment(departmentData);
    
    return res.status(201).json({
      success: true,
      data: department
    });
  } catch (error) {
    logger.error(`Error in createDepartment: ${error.message}`);
    next(error);
  }
};

/**
 * Update an existing department
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const { kddept } = req.params;
    const departmentData = req.body;
    
    if (!kddept) {
      return apiResponse.badRequest(res, "Department code (kddept) is required");
    }
    
    if (!departmentData.namadept) {
      return apiResponse.badRequest(res, "Department name (namadept) is required");
    }
    
    const department = await service.updateDepartment(kddept, departmentData);
    
    return res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    logger.error(`Error in updateDepartment: ${error.message}`);
    next(error);
  }
};

/**
 * Upload departments from file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const uploadDepartments = async (req, res, next) => {
  try {
    const { departments } = req.body;
    
    if (!departments || !Array.isArray(departments)) {
      return apiResponse.badRequest(res, "Departments array is required");
    }
    
    const result = await service.uploadDepartments(departments);
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Error in uploadDepartments: ${error.message}`);
    next(error);
  }
};

// Removed default export - using named exports only