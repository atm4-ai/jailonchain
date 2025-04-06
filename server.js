
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));
app.use(express.json());

const dbPath = path.join(__dirname, "data.json");
const voteLogPath = path.join(__dirname, "vote_log.json");

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

function loadVotes() {
  try {
    return JSON.parse(fs.readFileSync(voteLogPath));
  } catch {
    return {};
  }
}
function saveVotes(votes) {
  fs.writeFileSync(voteLogPath, JSON.stringify(votes, null, 2));
}

app.get("/api/reports", (req, res) => {
  res.json(loadData());
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

app.post("/api/like/:address", (req, res) => {
  const address = req.params.address.toLowerCase();
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const votes = loadVotes();
  if (votes[ip] && votes[ip].includes(address)) {
    return res.status(429).json({ error: "你已经点过赞了" });
  }

  const data = loadData();
  const entry = data.find(e => e.address.toLowerCase() === address);
  if (!entry) return res.status(404).json({ error: "找不到该地址" });

  entry.likes = (entry.likes || 0) + 1;
  saveData(data);

  if (!votes[ip]) votes[ip] = [];
  votes[ip].push(address);
  saveVotes(votes);

  res.json({ success: true });
});

app.get("/api/top10", (req, res) => {
  const data = loadData();
  const top = [...data]
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 10);
  res.json(top);
});

app.listen(PORT, () => {
  console.log(`JAIL.ONCHAIN Server running on port ${PORT}`);
});
