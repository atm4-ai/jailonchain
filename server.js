
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));
app.use(express.json());

const dbPath = path.join(__dirname, "data.json");

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dbPath));
  } catch {
    return [];
  }
}

function saveData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

app.get("/api/reports", (req, res) => {
  res.json(loadData());
});

app.post("/api/report", (req, res) => {
  const { address, tags, description } = req.body;
  const data = loadData();
  if (data.find(item => item.address.toLowerCase() === address.toLowerCase())) {
    return res.status(400).json({ error: "Address already reported." });
  }
  data.push({ address, tags, description, likes: 0, tagVotes: {} });
  saveData(data);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
