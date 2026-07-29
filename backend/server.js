import express from "express";
import cors from "cors";
import "./database.js";
import cycleRoutes from "./routes/cycleRoutes.js";
import goalsRoutes from "./routes/goalsRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/cycle", cycleRoutes);
app.use("/api/goals", goalsRoutes);


app.get("/", (req, res) => {
    res.send("Backend is running!");
});


app.listen(3000, () => {
    console.log("Server running on port 3000");
});