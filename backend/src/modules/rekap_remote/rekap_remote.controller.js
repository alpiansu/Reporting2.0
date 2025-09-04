/**
 * Controller for rekap_remote endpoints
 */
const rekapRemoteService = require("./rekap_remote.service");
const rekapRemoteStagingService = require("./rekap_remote_staging.service");
const logger = require("../../config/logger");

class RekapRemoteController {
  /**
   * Get rekap data with filters
   * @swagger
   * /api/rekap-remote:
   *   get:
   *     summary: Get remote connection recap data
   *     tags: [RekapRemote]
   *     parameters:
   *       - in: query
   *         name: cab
   *         schema:
   *           type: string
   *         description: Branch code filter
   *       - in: query
   *         name: kdtk
   *         schema:
   *           type: string
   *         description: Store code filter
   *       - in: query
   *         name: module_name
   *         schema:
   *           type: string
   *         description: Module name filter
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Limit results
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *         description: Offset for pagination
   *     responses:
   *       200:
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/RekapRemote'
   *                 total:
   *                   type: integer
   *                 filters:
   *                   type: object
   */
  async getRekapData(req, res) {
    try {
      const filters = {
        cab: req.query.cab,
        kdtk: req.query.kdtk,
        moduleName: req.query.module_name,
        limit: req.query.limit,
        offset: req.query.offset,
      };

      const result = await rekapRemoteStagingService.getRekapData(filters);
      
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Error in getRekapData: ${error.message}`);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }

  /**
   * Get summary statistics
   * @swagger
   * /api/rekap-remote/summary:
   *   get:
   *     summary: Get summary statistics for remote connections
   *     tags: [RekapRemote]
   *     parameters:
   *       - in: query
   *         name: module_name
   *         schema:
   *           type: string
   *         description: Module name filter
   *     responses:
   *       200:
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 totalRecords:
   *                   type: integer
   *                 statusDistribution:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       status:
   *                         type: string
   *                       count:
   *                         type: integer
   *                 moduleName:
   *                   type: string
   */
  async getSummary(req, res) {
    try {
      const moduleName = req.query.module_name;
      const result = await rekapRemoteStagingService.getSummary(moduleName);
      
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Error in getSummary: ${error.message}`);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }

  /**
   * Manually save logs to database (for testing)
   * @swagger
   * /api/rekap-remote/save-logs:
   *   post:
   *     summary: Manually save accumulated logs to database
   *     tags: [RekapRemote]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               module_name:
   *                 type: string
   *                 description: Module name filter (optional)
   *     responses:
   *       200:
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 savedCount:
   *                   type: integer
   *                 totalLogs:
   *                   type: integer
   *                 message:
   *                   type: string
   */
  async saveLogsManually(req, res) {
    try {
      const { module_name } = req.body;
      const result = await rekapRemoteService.saveLogsToDatabase(module_name);
      
      res.status(200).json(result);
    } catch (error) {
      logger.error(`Error in saveLogsManually: ${error.message}`);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }



  /**
   * Clear logs from memory (for testing)
   * @swagger
   * /api/rekap-remote/clear-logs:
   *   delete:
   *     summary: Clear all logs from memory
   *     tags: [RekapRemote]
   *     responses:
   *       200:
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   */
  async clearLogs(req, res) {
    try {
      rekapRemoteService.clearLogs();
      
      res.status(200).json({
        success: true,
        message: "All logs cleared from memory",
      });
    } catch (error) {
      logger.error(`Error in clearLogs: ${error.message}`);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
}

module.exports = new RekapRemoteController();