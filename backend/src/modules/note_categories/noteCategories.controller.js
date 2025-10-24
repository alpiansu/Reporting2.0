/**
 * Controller for Note Categories CRUD
 */
import service from "./noteCategories.service.js";

export const getAll = async (req, res) => {
  try {
    // Extract query parameters for pagination and filtering
    const { page, limit, sortColumn, sortOrder, searchQuery } = req.query;

    // Prepare options object
    const options = {};
    if (page) options.page = page;
    if (limit) options.limit = limit;
    if (sortColumn) options.sortColumn = sortColumn;
    if (sortOrder) options.sortOrder = sortOrder;
    if (searchQuery) options.searchQuery = searchQuery;

    const result = await service.getAll(options);

    // Format response to match what the frontend DataTable expects
    if (options.page && options.limit) {
      // Return paginated response
      res.json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } else {
      // Return simple array response (backward compatibility)
      res.json({ success: true, data: result.data, count: result.data.length });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const create = async (req, res) => {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const remove = async (req, res) => {
  try {
    await service.remove(req.params.id);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
