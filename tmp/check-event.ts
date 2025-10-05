import { query } from "../src/config/database";

(async () => {
  try {
    const eventId = process.argv[2];
    const res = await query("SELECT * FROM events WHERE id = $1", [eventId]);
    console.log(res.rows);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
})();
