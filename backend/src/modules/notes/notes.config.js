/**
 * Configuration for Notes module
 */
import path from "path";

export default {
  jsonPath: path.join(process.cwd(), "data/notes.json"),
  cacheTTL: 60 * 1000, // 1 minute cache
};
