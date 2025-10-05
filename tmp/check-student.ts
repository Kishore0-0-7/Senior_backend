import { query } from "../src/config/database";

(async () => {
  try {
    const userId = process.argv[2];
    const res = await query("SELECT id FROM students WHERE user_id = $1", [
      userId,
    ]);
    console.log(res.rows);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
})();
