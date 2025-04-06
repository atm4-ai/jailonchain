
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));
app.use(express.json());

const dbPath = path.join(__dirname, "data.json");
const ipLogPath = path.join(__dirname, "ip_data.json");

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

function loadIPLog() {
  try {
    return JSON.parse(fs.readFileSync(ipLogPath));
  } catch {
    return {};
  }
}

function saveIPLog(log) {
  fs.writeFileSync(ipLogPath, JSON.stringify(log, null, 2));
}

app.get("/api/reports", (req, res) => {
  res.json(loadData());
});

app.get("/api/bounty", (req, res) => {
  const data = loadData();
  const top10 = data.sort((a, b) => b.likes - a.likes).slice(0, 10);
  res.json(top10);
});

app.post("/api/report", (req, res) => {
  const { address, tags, description } = req.body;
  const data = loadData();
  if (data.find(item => item.address.toLowerCase() === address.toLowerCase())) {
    return res.status(400).json({ error: "地址已存在" });
  }
  data.push({ address, tags, description, likes: 0, tagVotes: {} });
  saveData(data);
  res.json({ success: true });
});


app.post("/api/like", (req, res) => {
  const ip = req.ip;
  const { address, tag } = req.body;
  const data = loadData();
  const ipLog = loadIPLog();
  const today = new Date().toISOString().split("T")[0];

  if (!ipLog[today]) ipLog[today] = {};
  if (!ipLog[today][ip]) ipLog[today][ip] = [];

  const key = `${address.toLowerCase()}-${tag}`;
  if (ipLog[today][ip].includes(key)) {
    return res.status(403).json({ error: "你今天已经点过这个标签了" });
  }

  const report = data.find(item => item.address.toLowerCase() === address.toLowerCase());
  if (!report) return res.status(404).json({ error: "地址不存在" });

  if (!report.tagVotes) report.tagVotes = {};
  if (!report.tagVotes[tag]) report.tagVotes[tag] = 0;
  report.tagVotes[tag] += 1;

  ipLog[today][ip].push(key);
  saveData(data);
  saveIPLog(ipLog);
  res.json({ success: true });
});
);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
