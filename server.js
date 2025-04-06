const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ CORS 防跨域（上线时建议替换 origin 为你的前端域名）
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

app.use(express.static("public"));
app.use(express.json());

// ✅ 数据文件路径
const dbPath = path.join(__dirname, "data.json");
const ipLogPath = path.join(__dirname, "ip_data.json");

// ✅ 异步读写封装
async function loadData() {
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
async function saveData(data) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
}
async function loadIPLog() {
  try {
    const raw = await fs.readFile(ipLogPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function saveIPLog(log) {
  await fs.writeFile(ipLogPath, JSON.stringify(log, null, 2));
}

// ✅ 点赞限流（每 IP 每 10 秒最多 3 次）
const likeLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 3,
  message: { success: false, error: "点赞太频繁，请稍后再试" }
});

// ✅ 广告关键词拦截函数
function containsBannedContent(text) {
  const BANNED = [
    "微信", "TG", "t.me", "赚钱", "成人", "裸", "av",
    "https://", "http://", ".cn", ".xyz", "邀请", "群"
  ];
  const lower = text.toLowerCase();
  return BANNED.some(word => lower.includes(word));
}

// ✅ 获取所有爆料
app.get("/api/reports", async (req, res) => {
  const data = await loadData();
  res.json(data);
});

// ✅ 获取前10个点赞最多的地址
app.get("/api/bounty", async (req, res) => {
  const data = await loadData();
  const top10 = data.sort((a, b) => b.likes - a.likes).slice(0, 10);
  res.json(top10);
});

// ✅ 提交爆料（自动过滤违规词）
app.post("/api/report", async (req, res) => {
  const { address, tags, description } = req.body;

  if (
    !/^0x[a-fA-F0-9]{40}$/.test(address) ||
    !Array.isArray(tags) ||
    tags.some(tag => typeof tag !== 'string' || tag.length > 20 || containsBannedContent(tag)) ||
    typeof description !== 'string' ||
    description.length > 500 ||
    containsBannedContent(description)
  ) {
    return res.status(400).json({ error: "提交内容不合法或包含禁止词" });
  }

  const data = await loadData();
  if (data.find(item => item.address.toLowerCase() === address.toLowerCase())) {
    return res.status(400).json({ error: "地址已存在" });
  }

  data.push({
    address: address.toLowerCase(),
    tags,
    description,
    likes: 0,
    tagVotes: {}
  });

  await saveData(data);
  res.json({ success: true });
});

// ✅ 点赞功能（带限流 + IP 日志）
app.post("/api/like", likeLimiter, async (req, res) => {
  const ip = req.ip;
  const { address, tag } = req.body;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address) || typeof tag !== "string" || tag.length > 20) {
    return res.status(400).json({ error: "点赞参数非法" });
  }

  const data = await loadData();
  const ipLog = await loadIPLog();
  const today = new Date().toISOString().split("T")[0];
  const lowerAddress = address.toLowerCase();

  if (!ipLog[today]) ipLog[today] = {};
  if (!ipLog[today][ip]) ipLog[today][ip] = [];

  const key = `${lowerAddress}-${tag}`;
  if (ipLog[today][ip].includes(key)) {
    return res.status(403).json({ error: "你今天已经点过这个标签了" });
  }

  const report = data.find(item => item.address.toLowerCase() === lowerAddress);
  if (!report) return res.status(404).json({ error: "地址不存在" });

  if (!report.tagVotes) report.tagVotes = {};
  if (!report.tagVotes[tag]) report.tagVotes[tag] = 0;
  report.tagVotes[tag] += 1;

  ipLog[today][ip].push(key);
  await saveData(data);
  await saveIPLog(ipLog);
  res.json({ success: true });
});

// ✅ 启动服务
app.listen(PORT, () => {
  console.log(`Secure server v2 running at http://localhost:${PORT}`);
});
