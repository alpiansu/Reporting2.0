/**
 * Configuration for Note Categories module
 */
import path from "path";

export default {
  jsonPath: path.join(process.cwd(), "data/note_categories.json"),
  cacheTTL: 60 * 1000, // 1 minute
};
