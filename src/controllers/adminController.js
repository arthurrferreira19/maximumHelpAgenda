const { asyncHandler } = require("../utils/asyncHandler");
const adminService = require("../services/adminService");

const dashboardSummary = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboardSummary();
  res.json(data);
});

module.exports = { dashboardSummary };
