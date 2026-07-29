import express from "express";
import db from "../database.js";

const router = express.Router();

const ALLOWED_CATEGORIES = new Set(["pregnancy", "lifestyle"]);

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  const trimmed = String(value || "").trim();
  return trimmed || "campbell.lowe";
}

function safeJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

router.get("/", (req, res) => {
  const username = normalizeUsername(req.query.username);
  const category = normalizeCategory(req.query.category);

  if (!ALLOWED_CATEGORIES.has(category)) {
    return res.status(400).json({
      error: "Invalid category. Use pregnancy or lifestyle.",
    });
  }

  db.all(
    `
      SELECT goal_id, name, completed_dates, position
      FROM wellness_goals
      WHERE username = ? AND category = ?
      ORDER BY position ASC, id ASC;
    `,
    [username, category],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      const goals = rows.map((row) => ({
        id: row.goal_id,
        name: row.name,
        completedDates: safeJsonArray(row.completed_dates),
      }));

      res.json({ username, category, goals });
    }
  );
});

router.put("/", (req, res) => {
  const username = normalizeUsername(req.body.username);
  const category = normalizeCategory(req.body.category);
  const goals = Array.isArray(req.body.goals) ? req.body.goals : [];

  if (!ALLOWED_CATEGORIES.has(category)) {
    return res.status(400).json({
      error: "Invalid category. Use pregnancy or lifestyle.",
    });
  }

  const normalizedGoals = goals
    .map((goal, index) => {
      const id = String(goal?.id ?? "").trim();
      const name = String(goal?.name ?? "").trim();
      const completedDates = Array.isArray(goal?.completedDates)
        ? goal.completedDates.filter((value) => typeof value === "string" && value.trim() !== "")
        : [];

      if (!id || !name) {
        return null;
      }

      return {
        id,
        name,
        completedDates,
        position: index,
      };
    })
    .filter(Boolean);

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.run(
      "DELETE FROM wellness_goals WHERE username = ? AND category = ?",
      [username, category],
      (deleteError) => {
        if (deleteError) {
          console.error(deleteError);
          db.run("ROLLBACK");
          return res.status(500).json({ error: deleteError.message });
        }

        const insertSql = `
          INSERT INTO wellness_goals (
            username,
            category,
            goal_id,
            name,
            completed_dates,
            position
          ) VALUES (?, ?, ?, ?, ?, ?);
        `;

        let pending = normalizedGoals.length;

        if (pending === 0) {
          db.run("COMMIT", (commitError) => {
            if (commitError) {
              console.error(commitError);
              db.run("ROLLBACK");
              return res.status(500).json({ error: commitError.message });
            }

            res.json({ success: true, username, category, count: 0 });
          });
          return;
        }

        let hasFailed = false;

        normalizedGoals.forEach((goal) => {
          db.run(
            insertSql,
            [
              username,
              category,
              goal.id,
              goal.name,
              JSON.stringify(goal.completedDates),
              goal.position,
            ],
            (insertError) => {
              if (hasFailed) {
                return;
              }

              if (insertError) {
                hasFailed = true;
                console.error(insertError);
                db.run("ROLLBACK");
                res.status(500).json({ error: insertError.message });
                return;
              }

              pending -= 1;

              if (pending === 0) {
                db.run("COMMIT", (commitError) => {
                  if (commitError) {
                    console.error(commitError);
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: commitError.message });
                  }

                  res.json({
                    success: true,
                    username,
                    category,
                    count: normalizedGoals.length,
                  });
                });
              }
            }
          );
        });
      }
    );
  });
});

export default router;
