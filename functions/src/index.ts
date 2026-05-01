import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const OpenAIModule: any = require("openai").default || require("openai");

// ============================================================
// INIT
// ============================================================
admin.initializeApp();
const db = admin.firestore();
const app = express();

const APP_VERSION = process.env.APP_VERSION || "1.1.0";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cache-Control", "no-store");
  next();
});

let openai: any;
try {
  openai = new OpenAIModule({
    apiKey: process.env.OPENAI_API_KEY || "",
  });
} catch {
  openai = { chat: { completions: { create: async () => ({ choices: [{ message: { content: "AI unavailable" } }] }) } } };
}

// Chairman email constant
const CHAIRMAN_EMAIL = "trunghaukimdunggroup@gmail.com";
const VALID_ROLES = new Set(["chairman", "ceo", "admin", "manager", "staff"]);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "CEO Trung Kim AI OS API",
    version: APP_VERSION,
    time: new Date().toISOString(),
  });
});

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
interface AuthRequest extends express.Request {
  uid?: string;
  userRole?: string;
  userName?: string;
  userEmail?: string;
}

async function authMiddleware(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    req.userEmail = decoded.email || "";
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      // Auto-upgrade to chairman if email matches
      if (decoded.email === CHAIRMAN_EMAIL && data?.role !== "chairman") {
        await db.collection("users").doc(decoded.uid).update({ role: "chairman", updatedAt: now() });
        req.userRole = "chairman";
      } else {
        req.userRole = data?.role || "staff";
      }
      req.userName = data?.name || decoded.name || "User";
    } else {
      // Auto-create user on first login — chairman if email matches
      const role = decoded.email === CHAIRMAN_EMAIL ? "chairman" : "staff";
      await db.collection("users").doc(decoded.uid).set({
        name: decoded.name || "User",
        email: decoded.email || "",
        role,
        createdAt: now(),
        updatedAt: now(),
      });
      req.userRole = role;
      req.userName = decoded.name || "User";
    }
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    // Chairman has access to everything
    if (req.userRole === "chairman") return next();
    if (!roles.includes(req.userRole || "")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

app.use(authMiddleware);

// ============================================================
// HELPERS
// ============================================================
const now = () => admin.firestore.FieldValue.serverTimestamp();
const toDate = (ts: any) => ts?.toDate?.() ? ts.toDate().toISOString() : ts;

function docToJson(doc: admin.firestore.DocumentSnapshot) {
  const data = doc.data();
  if (!data) return null;
  const result: any = { id: doc.id };
  for (const [k, v] of Object.entries(data)) {
    result[k] = v instanceof admin.firestore.Timestamp ? v.toDate().toISOString() : v;
  }
  return result;
}

async function queryToJson(ref: admin.firestore.Query) {
  const snap = await ref.get();
  return snap.docs.map((d) => docToJson(d)).filter(Boolean);
}

async function addAuditLog(action: string, userId: string, details: any = {}) {
  await db.collection("audit_trail").add({
    action, userId, details, createdAt: now(),
  });
}

// ============================================================
// AUTH ROUTES
// ============================================================
app.get("/auth/me", async (req: AuthRequest, res) => {
  const userDoc = await db.collection("users").doc(req.uid!).get();
  res.json(docToJson(userDoc));
});

app.put("/auth/role", requireRole("admin"), async (req: AuthRequest, res) => {
  const { userId, role } = req.body;
  if (!userId || !VALID_ROLES.has(role)) {
    res.status(400).json({ error: "Invalid userId or role" });
    return;
  }
  if (role === "chairman" && req.userEmail !== CHAIRMAN_EMAIL) {
    res.status(403).json({ error: "Only chairman can grant chairman role" });
    return;
  }
  await db.collection("users").doc(userId).update({ role, updatedAt: now() });
  await addAuditLog("role_change", req.uid!, { userId, role });
  res.json({ success: true });
});

// ============================================================
// EMPLOYEES / USERS
// ============================================================
app.get("/employees", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("users").orderBy("createdAt", "desc")));
});

app.post("/employees", requireRole("admin"), async (req: AuthRequest, res) => {
  const role = req.body.role || "staff";
  if (!VALID_ROLES.has(role) || role === "chairman") {
    res.status(400).json({ error: "Invalid employee role" });
    return;
  }
  const ref = await db.collection("users").add({
    ...req.body, role, createdAt: now(), updatedAt: now(),
  });
  await addAuditLog("employee_create", req.uid!, { id: ref.id });
  res.json({ success: true, id: ref.id });
});

// ============================================================
// SHIFTS
// ============================================================
app.get("/shifts", async (req: AuthRequest, res) => {
  const { date } = req.query;
  let ref: admin.firestore.Query = db.collection("shifts").orderBy("date", "desc").limit(100);
  if (date) ref = db.collection("shifts").where("date", "==", date);
  res.json(await queryToJson(ref));
});

app.post("/shifts", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const ref = await db.collection("shifts").add({ ...req.body, status: "pending", createdAt: now() });
  res.json({ success: true, id: ref.id });
});

app.put("/shifts/:id/approve", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  await db.collection("shifts").doc(req.params.id).update({
    status: "approved", approvedBy: req.uid, approvedAt: now(),
  });
  res.json({ success: true });
});

// ============================================================
// ATTENDANCE
// ============================================================
app.get("/attendance", async (req: AuthRequest, res) => {
  const { date, userId } = req.query;
  let ref: admin.firestore.Query = db.collection("attendance").orderBy("checkIn", "desc").limit(200);
  if (date) ref = db.collection("attendance").where("date", "==", date);
  if (userId) ref = db.collection("attendance").where("userId", "==", userId);
  res.json(await queryToJson(ref));
});

app.post("/attendance/checkin", async (req: AuthRequest, res) => {
  const today = new Date().toISOString().split("T")[0];
  const existing = await db.collection("attendance")
    .where("userId", "==", req.uid)
    .where("date", "==", today)
    .get();
  if (!existing.empty) {
    res.status(400).json({ error: "Đã chấm công hôm nay" });
    return;
  }
  const nowTime = new Date();
  const hour = nowTime.getHours();
  const minute = nowTime.getMinutes();
  let status = "on_time";
  if (hour > 8 || (hour === 8 && minute > 0)) status = "late";
  const ref = await db.collection("attendance").add({
    userId: req.uid,
    userName: req.userName,
    date: today,
    checkIn: admin.firestore.Timestamp.fromDate(nowTime),
    status,
    createdAt: now(),
  });
  // Create notification
  await db.collection("notifications").add({
    userId: req.uid, type: "attendance",
    title: `${req.userName} đã chấm công vào`,
    message: `Thời gian: ${nowTime.toLocaleTimeString("vi-VN")} - ${status === "late" ? "Trễ" : "Đúng giờ"}`,
    read: false, createdAt: now(),
  });
  res.json({ success: true, id: ref.id, status });
});

app.post("/attendance/checkout", async (req: AuthRequest, res) => {
  const today = new Date().toISOString().split("T")[0];
  const existing = await db.collection("attendance")
    .where("userId", "==", req.uid)
    .where("date", "==", today)
    .get();
  if (existing.empty) {
    res.status(400).json({ error: "Chưa chấm công vào" });
    return;
  }
  const doc = existing.docs[0];
  await doc.ref.update({ checkOut: admin.firestore.Timestamp.fromDate(new Date()), updatedAt: now() });
  res.json({ success: true });
});

// ============================================================
// TASKS
// ============================================================
app.get("/tasks", async (req: AuthRequest, res) => {
  const { status, assigneeId } = req.query;
  let ref: admin.firestore.Query = db.collection("tasks").orderBy("createdAt", "desc").limit(200);
  if (status) ref = db.collection("tasks").where("status", "==", status);
  if (assigneeId) ref = db.collection("tasks").where("assigneeId", "==", assigneeId);
  res.json(await queryToJson(ref));
});

app.post("/tasks", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const ref = await db.collection("tasks").add({
    ...req.body, status: "pending", createdBy: req.uid, createdAt: now(), updatedAt: now(),
  });
  // Notify assignee
  if (req.body.assigneeId) {
    await db.collection("notifications").add({
      userId: req.body.assigneeId, type: "task",
      title: "Công việc mới được giao",
      message: req.body.title || "Bạn có công việc mới",
      read: false, createdAt: now(),
    });
  }
  res.json({ success: true, id: ref.id });
});

app.put("/tasks/:id/status", async (req: AuthRequest, res) => {
  const { status } = req.body;
  await db.collection("tasks").doc(req.params.id).update({ status, updatedAt: now() });
  res.json({ success: true });
});

// ============================================================
// ALERTS
// ============================================================
app.get("/alerts", async (req: AuthRequest, res) => {
  const { status } = req.query;
  let ref: admin.firestore.Query = db.collection("alerts").orderBy("createdAt", "desc").limit(100);
  if (status) ref = db.collection("alerts").where("status", "==", status);
  res.json(await queryToJson(ref));
});

app.post("/alerts", requireRole("manager", "admin", "ceo", "staff"), async (req: AuthRequest, res) => {
  const ref = await db.collection("alerts").add({
    ...req.body, status: "active", createdBy: req.uid, createdAt: now(),
  });
  res.json({ success: true, id: ref.id });
});

app.put("/alerts/:id/resolve", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  await db.collection("alerts").doc(req.params.id).update({
    status: "resolved", resolvedBy: req.uid, resolvedAt: now(),
  });
  res.json({ success: true });
});

// ============================================================
// NOTIFICATIONS
// ============================================================
app.get("/notifications", async (req: AuthRequest, res) => {
  res.json(await queryToJson(
    db.collection("notifications").where("userId", "==", req.uid).orderBy("createdAt", "desc").limit(50)
  ));
});

app.get("/notifications/unread-count", async (req: AuthRequest, res) => {
  const snap = await db.collection("notifications")
    .where("userId", "==", req.uid).where("read", "==", false).count().get();
  res.json({ count: snap.data().count });
});

app.put("/notifications/:id/read", async (req: AuthRequest, res) => {
  await db.collection("notifications").doc(req.params.id).update({ read: true });
  res.json({ success: true });
});

app.put("/notifications/read-all", async (req: AuthRequest, res) => {
  const snap = await db.collection("notifications")
    .where("userId", "==", req.uid).where("read", "==", false).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
  res.json({ success: true });
});

// ============================================================
// KPI
// ============================================================
app.get("/kpi", async (req: AuthRequest, res) => {
  const { month } = req.query;
  let ref: admin.firestore.Query = db.collection("kpi").orderBy("createdAt", "desc").limit(100);
  if (month) ref = db.collection("kpi").where("month", "==", month);
  res.json(await queryToJson(ref));
});

app.post("/kpi", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const ref = await db.collection("kpi").add({ ...req.body, createdBy: req.uid, createdAt: now() });
  res.json({ success: true, id: ref.id });
});

// ============================================================
// DASHBOARD
// ============================================================
app.get("/dashboard/summary", async (req: AuthRequest, res) => {
  const [employees, alerts, tasks, attendance] = await Promise.all([
    db.collection("users").count().get(),
    db.collection("alerts").where("status", "==", "active").count().get(),
    db.collection("tasks").where("status", "==", "pending").count().get(),
    db.collection("attendance").where("date", "==", new Date().toISOString().split("T")[0]).count().get(),
  ]);
  res.json({
    totalEmployees: employees.data().count,
    activeAlerts: alerts.data().count,
    pendingTasks: tasks.data().count,
    todayAttendance: attendance.data().count,
  });
});

app.get("/dashboard/revenue-trend", async (req: AuthRequest, res) => {
  const days = parseInt(req.query.days as string) || 7;
  const snap = await db.collection("revenue").orderBy("date", "desc").limit(days).get();
  res.json(snap.docs.map(d => docToJson(d)).filter(Boolean));
});

// ============================================================
// AI CHAT
// ============================================================
app.post("/ai/chat", async (req: AuthRequest, res) => {
  const { message, conversationHistory = [] } = req.body;
  try {
    const systemPrompt = `Bạn là AI Assistant của CEO Trung Kim AI OS — hệ điều hành AI cho Di Động Trung Hậu Kim Dung.
Bạn hỗ trợ quản lý nhân sự, ca làm, kho hàng, công nợ, bảo hành, và phân tích kinh doanh.
Trả lời bằng tiếng Việt, ngắn gọn, chuyên nghiệp. Người dùng hiện tại: ${req.userName} (${req.userRole}).`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || "Xin lỗi, tôi không thể trả lời lúc này.";
    // Save to chat history
    await db.collection("chat_history").add({
      userId: req.uid, userName: req.userName,
      message, reply, createdAt: now(),
    });
    res.json({ reply, model: "gpt-4o-mini" });
  } catch (err: any) {
    res.json({ reply: "AI tạm thời không khả dụng. Vui lòng thử lại sau.", error: err.message });
  }
});

// ============================================================
// AI TASK ASSIGNMENT
// ============================================================
app.post("/ai/assign-tasks", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  try {
    const [employees, tasks] = await Promise.all([
      queryToJson(db.collection("users").where("role", "==", "staff")),
      queryToJson(db.collection("tasks").where("status", "in", ["pending", "in_progress"])),
    ]);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Bạn là AI phân công việc. Dựa trên danh sách nhân viên và công việc hiện tại, đề xuất phân công hợp lý. Trả lời JSON array [{taskId, assigneeId, reason}]." },
        { role: "user", content: `Nhân viên: ${JSON.stringify(employees)}\nCông việc: ${JSON.stringify(tasks)}` },
      ],
      max_tokens: 500,
    });
    res.json({ suggestions: completion.choices[0]?.message?.content });
  } catch (err: any) {
    res.json({ suggestions: "AI không khả dụng", error: err.message });
  }
});

// ============================================================
// AI SHIFT SUGGESTION
// ============================================================
app.post("/ai/suggest-shifts", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  try {
    const employees = await queryToJson(db.collection("users"));
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Bạn là AI xếp ca. Dựa trên danh sách nhân viên, đề xuất lịch ca hợp lý cho tuần tới. Trả lời bảng markdown." },
        { role: "user", content: `Nhân viên: ${JSON.stringify(employees)}\nYêu cầu: ${req.body.requirements || "Xếp ca cân bằng"}` },
      ],
      max_tokens: 800,
    });
    res.json({ suggestion: completion.choices[0]?.message?.content });
  } catch (err: any) {
    res.json({ suggestion: "AI không khả dụng", error: err.message });
  }
});

// ============================================================
// AI PERFORMANCE AUDIT
// ============================================================
app.post("/ai/perf-audit", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  try {
    const [attendance, tasks, kpi] = await Promise.all([
      queryToJson(db.collection("attendance").orderBy("checkIn", "desc").limit(200)),
      queryToJson(db.collection("tasks").orderBy("createdAt", "desc").limit(200)),
      queryToJson(db.collection("kpi").orderBy("createdAt", "desc").limit(50)),
    ]);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Bạn là AI đánh giá hiệu suất nhân viên. Phân tích dữ liệu chấm công, công việc, KPI và đưa ra đánh giá chi tiết. Trả lời bằng tiếng Việt." },
        { role: "user", content: `Chấm công: ${JSON.stringify(attendance.slice(0, 50))}\nCông việc: ${JSON.stringify(tasks.slice(0, 50))}\nKPI: ${JSON.stringify(kpi.slice(0, 20))}` },
      ],
      max_tokens: 1000,
    });
    res.json({ audit: completion.choices[0]?.message?.content });
  } catch (err: any) {
    res.json({ audit: "AI không khả dụng", error: err.message });
  }
});

// ============================================================
// WARRANTY
// ============================================================
app.get("/warranty", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("warranty_tickets").orderBy("createdAt", "desc").limit(100)));
});

app.post("/warranty", async (req: AuthRequest, res) => {
  const ref = await db.collection("warranty_tickets").add({
    ...req.body, status: "received", createdBy: req.uid, createdAt: now(), updatedAt: now(),
  });
  res.json({ success: true, id: ref.id });
});

app.put("/warranty/:id/status", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const { status, note } = req.body;
  await db.collection("warranty_tickets").doc(req.params.id).update({ status, note, updatedAt: now() });
  res.json({ success: true });
});

// ============================================================
// PRODUCTS
// ============================================================
app.get("/products", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("products").orderBy("name")));
});

app.post("/products", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const ref = await db.collection("products").add({ ...req.body, createdAt: now(), updatedAt: now() });
  res.json({ success: true, id: ref.id });
});

app.put("/products/:id", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  await db.collection("products").doc(req.params.id).update({ ...req.body, updatedAt: now() });
  res.json({ success: true });
});

app.delete("/products/:id", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  await db.collection("products").doc(req.params.id).delete();
  res.json({ success: true });
});

// ============================================================
// SUPPLIERS
// ============================================================
app.get("/suppliers", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("suppliers").orderBy("name")));
});

app.post("/suppliers", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const ref = await db.collection("suppliers").add({ ...req.body, createdAt: now(), updatedAt: now() });
  res.json({ success: true, id: ref.id });
});

app.put("/suppliers/:id", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  await db.collection("suppliers").doc(req.params.id).update({ ...req.body, updatedAt: now() });
  res.json({ success: true });
});

// ============================================================
// FINANCE COMPANIES
// ============================================================
app.get("/finance-companies", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("finance_companies").orderBy("name")));
});

app.post("/finance-companies", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const ref = await db.collection("finance_companies").add({ ...req.body, createdAt: now(), updatedAt: now() });
  res.json({ success: true, id: ref.id });
});

app.put("/finance-companies/:id", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  await db.collection("finance_companies").doc(req.params.id).update({ ...req.body, updatedAt: now() });
  res.json({ success: true });
});

// ============================================================
// IMEI STOCK
// ============================================================
app.get("/imei-stock", async (req: AuthRequest, res) => {
  const { status, productId, search } = req.query;
  let ref: admin.firestore.Query = db.collection("imei_items").orderBy("importedAt", "desc").limit(500);
  if (status) ref = db.collection("imei_items").where("status", "==", status);
  if (productId) ref = db.collection("imei_items").where("productId", "==", productId);
  const items = await queryToJson(ref);
  if (search) {
    const s = (search as string).toLowerCase();
    return res.json(items.filter((i: any) => i.imei?.toLowerCase().includes(s)));
  }
  res.json(items);
});

app.get("/imei-stock/lookup", async (req: AuthRequest, res) => {
  const { imei } = req.query;
  if (!imei) return res.status(400).json({ error: "IMEI required" });
  const snap = await db.collection("imei_items").where("imei", "==", imei).get();
  if (snap.empty) return res.json(null);
  res.json(docToJson(snap.docs[0]));
});

app.get("/imei-stock/stats", async (req: AuthRequest, res) => {
  const snap = await db.collection("imei_items").get();
  const items = snap.docs.map(d => d.data());
  const inStock = items.filter(i => i.status === "in_stock").length;
  const sold = items.filter(i => i.status === "sold").length;
  const defective = items.filter(i => i.status === "defective").length;
  const totalValue = items.filter(i => i.status === "in_stock").reduce((sum, i) => sum + (i.importPrice || 0), 0);
  res.json({ total: items.length, inStock, sold, defective, totalValue });
});

app.post("/imei-stock/import", async (req: AuthRequest, res) => {
  const { imeiList, productId, productName, supplierId, importPrice } = req.body;
  if (!imeiList?.length) return res.status(400).json({ error: "IMEI list required" });
  const batch = db.batch();
  const results: any[] = [];
  for (const imei of imeiList) {
    const existing = await db.collection("imei_items").where("imei", "==", imei).get();
    if (!existing.empty) {
      results.push({ imei, status: "duplicate" });
      continue;
    }
    const ref = db.collection("imei_items").doc();
    batch.set(ref, {
      imei, productId, productName, supplierId, importPrice: importPrice || 0,
      status: "in_stock", importedAt: now(), importedBy: req.uid,
    });
    results.push({ imei, status: "imported", id: ref.id });
  }
  await batch.commit();
  // Update supplier debt if supplierId
  if (supplierId) {
    const totalCost = imeiList.length * (importPrice || 0);
    if (totalCost > 0) {
      await db.collection("supplier_debts").add({
        supplierId, type: "purchase", amount: totalCost,
        description: `Nhập ${imeiList.length} IMEI - ${productName || ""}`,
        status: "unpaid", createdAt: now(),
      });
    }
  }
  await addAuditLog("imei_import", req.uid!, { count: imeiList.length, productId });
  res.json({ success: true, results });
});

app.post("/imei-stock/sell", async (req: AuthRequest, res) => {
  const { imei, customerId, salePrice } = req.body;
  const snap = await db.collection("imei_items").where("imei", "==", imei).get();
  if (snap.empty) return res.status(404).json({ error: "IMEI not found" });
  const doc = snap.docs[0];
  if (doc.data().status !== "in_stock") return res.status(400).json({ error: "IMEI not in stock" });
  await doc.ref.update({ status: "sold", soldAt: now(), customerId, salePrice, soldBy: req.uid });
  // Record revenue
  await db.collection("revenue").add({
    type: "imei_sale", imei, amount: salePrice || 0, customerId,
    date: new Date().toISOString().split("T")[0], createdAt: now(),
  });
  await addAuditLog("imei_sell", req.uid!, { imei, salePrice });
  res.json({ success: true });
});

app.post("/imei-stock/defective", async (req: AuthRequest, res) => {
  const { imei, reason } = req.body;
  const snap = await db.collection("imei_items").where("imei", "==", imei).get();
  if (snap.empty) return res.status(404).json({ error: "IMEI not found" });
  await snap.docs[0].ref.update({ status: "defective", defectReason: reason, updatedAt: now() });
  res.json({ success: true });
});

app.post("/imei-stock/export", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const { imei, reason } = req.body;
  const snap = await db.collection("imei_items").where("imei", "==", imei).get();
  if (snap.empty) return res.status(404).json({ error: "IMEI not found" });
  await snap.docs[0].ref.update({ status: "exported", exportReason: reason, exportedAt: now() });
  res.json({ success: true });
});

// ============================================================
// NON-IMEI STOCK (Batches)
// ============================================================
app.get("/non-imei-stock", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("stock_batches").orderBy("importedAt", "desc")));
});

app.post("/non-imei-stock/import", async (req: AuthRequest, res) => {
  const { productId, productName, quantity, unitPrice, supplierId } = req.body;
  const ref = await db.collection("stock_batches").add({
    productId, productName, quantity, remainingQty: quantity,
    unitPrice: unitPrice || 0, supplierId,
    importedAt: now(), importedBy: req.uid,
  });
  if (supplierId && quantity * (unitPrice || 0) > 0) {
    await db.collection("supplier_debts").add({
      supplierId, type: "purchase", amount: quantity * unitPrice,
      description: `Nhập ${quantity} ${productName || ""}`,
      status: "unpaid", createdAt: now(),
    });
  }
  await addAuditLog("non_imei_import", req.uid!, { productId, quantity });
  res.json({ success: true, id: ref.id });
});

app.post("/non-imei-stock/consume", async (req: AuthRequest, res) => {
  const { batchId, quantity, reason } = req.body;
  const doc = await db.collection("stock_batches").doc(batchId).get();
  if (!doc.exists) return res.status(404).json({ error: "Batch not found" });
  const remaining = doc.data()?.remainingQty || 0;
  if (quantity > remaining) return res.status(400).json({ error: "Không đủ số lượng" });
  await doc.ref.update({ remainingQty: remaining - quantity, updatedAt: now() });
  res.json({ success: true, newRemaining: remaining - quantity });
});

app.get("/non-imei-stock/summary", async (req: AuthRequest, res) => {
  const snap = await db.collection("stock_batches").get();
  const batches = snap.docs.map(d => d.data());
  const totalBatches = batches.length;
  const totalRemaining = batches.reduce((s, b) => s + (b.remainingQty || 0), 0);
  const totalValue = batches.reduce((s, b) => s + (b.remainingQty || 0) * (b.unitPrice || 0), 0);
  res.json({ totalBatches, totalRemaining, totalValue });
});

app.post("/non-imei-stock/export", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const { batchId, quantity, reason, customerId } = req.body;
  const doc = await db.collection("stock_batches").doc(batchId).get();
  if (!doc.exists) return res.status(404).json({ error: "Batch not found" });
  const remaining = doc.data()?.remainingQty || 0;
  if (quantity > remaining) return res.status(400).json({ error: "Không đủ số lượng" });
  await doc.ref.update({ remainingQty: remaining - quantity, updatedAt: now() });
  // Record revenue
  const salePrice = req.body.salePrice || doc.data()?.unitPrice || 0;
  await db.collection("revenue").add({
    type: "non_imei_sale", batchId, amount: quantity * salePrice,
    customerId, date: new Date().toISOString().split("T")[0], createdAt: now(),
  });
  res.json({ success: true });
});

// ============================================================
// PURCHASE ORDERS
// ============================================================
app.get("/purchase-orders", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("purchase_orders").orderBy("createdAt", "desc").limit(100)));
});

app.post("/purchase-orders", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const ref = await db.collection("purchase_orders").add({
    ...req.body, status: "pending", createdBy: req.uid, createdAt: now(), updatedAt: now(),
  });
  await addAuditLog("purchase_order_create", req.uid!, { id: ref.id });
  res.json({ success: true, id: ref.id });
});

app.put("/purchase-orders/:id", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  await db.collection("purchase_orders").doc(req.params.id).update({ ...req.body, updatedAt: now() });
  res.json({ success: true });
});

// ============================================================
// SUPPLIER RETURNS
// ============================================================
app.get("/supplier-returns", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("supplier_returns").orderBy("createdAt", "desc").limit(100)));
});

app.post("/supplier-returns", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const { supplierId, items, reason, totalAmount } = req.body;
  const ref = await db.collection("supplier_returns").add({
    supplierId, items, reason, totalAmount, status: "pending",
    createdBy: req.uid, createdAt: now(),
  });
  // Mark IMEI items as returned
  if (items?.length) {
    for (const item of items) {
      if (item.imei) {
        const snap = await db.collection("imei_items").where("imei", "==", item.imei).get();
        if (!snap.empty) await snap.docs[0].ref.update({ status: "returned", updatedAt: now() });
      }
    }
  }
  await addAuditLog("supplier_return", req.uid!, { supplierId, totalAmount });
  res.json({ success: true, id: ref.id });
});

app.put("/supplier-returns/:id/confirm", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  await db.collection("supplier_returns").doc(req.params.id).update({ status: "confirmed", confirmedAt: now() });
  res.json({ success: true });
});

// ============================================================
// STOCK CHECKS
// ============================================================
app.get("/stock-checks", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("stock_checks").orderBy("checkDate", "desc").limit(50)));
});

app.get("/stock-checks/:id", async (req: AuthRequest, res) => {
  const doc = await db.collection("stock_checks").doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: "Not found" });
  const items = await queryToJson(db.collection("stock_check_items").where("stockCheckId", "==", req.params.id));
  res.json({ ...docToJson(doc), items });
});

app.post("/stock-checks", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const ref = await db.collection("stock_checks").add({
    ...req.body, status: "in_progress", createdBy: req.uid,
    checkDate: new Date().toISOString().split("T")[0], createdAt: now(),
  });
  res.json({ success: true, id: ref.id });
});

app.post("/stock-checks/:id/items", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const { productId, productName, systemQty, actualQty } = req.body;
  const ref = await db.collection("stock_check_items").add({
    stockCheckId: req.params.id, productId, productName,
    systemQty: systemQty || 0, actualQty: actualQty || 0,
    difference: (actualQty || 0) - (systemQty || 0),
    createdAt: now(),
  });
  res.json({ success: true, id: ref.id });
});

app.put("/stock-checks/:id/items/:itemId", async (req: AuthRequest, res) => {
  const { actualQty } = req.body;
  const doc = await db.collection("stock_check_items").doc(req.params.itemId).get();
  const systemQty = doc.data()?.systemQty || 0;
  await doc.ref.update({ actualQty, difference: actualQty - systemQty, updatedAt: now() });
  res.json({ success: true });
});

app.put("/stock-checks/:id/complete", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  await db.collection("stock_checks").doc(req.params.id).update({
    status: "completed", completedAt: now(), completedBy: req.uid,
  });
  await addAuditLog("stock_check_complete", req.uid!, { checkId: req.params.id });
  res.json({ success: true });
});

// ============================================================
// SUPPLIER DEBTS
// ============================================================
app.get("/supplier-debts", async (req: AuthRequest, res) => {
  const { supplierId, status } = req.query;
  let ref: admin.firestore.Query = db.collection("supplier_debts").orderBy("createdAt", "desc").limit(200);
  if (supplierId) ref = db.collection("supplier_debts").where("supplierId", "==", supplierId);
  if (status) ref = db.collection("supplier_debts").where("status", "==", status);
  res.json(await queryToJson(ref));
});

app.get("/supplier-debts/summary", async (req: AuthRequest, res) => {
  const snap = await db.collection("supplier_debts").get();
  const debts = snap.docs.map(d => d.data());
  const totalDebt = debts.filter(d => d.status === "unpaid").reduce((s, d) => s + (d.amount || 0), 0);
  const totalPaid = debts.filter(d => d.status === "paid").reduce((s, d) => s + (d.amount || 0), 0);
  res.json({ totalDebt, totalPaid, count: debts.length });
});

app.post("/supplier-debts/pay", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const { debtId, amount, note } = req.body;
  const doc = await db.collection("supplier_debts").doc(debtId).get();
  if (!doc.exists) return res.status(404).json({ error: "Debt not found" });
  const currentAmount = doc.data()?.amount || 0;
  if (amount >= currentAmount) {
    await doc.ref.update({ status: "paid", paidAmount: amount, paidAt: now(), paidBy: req.uid, note });
  } else {
    await doc.ref.update({ amount: currentAmount - amount, updatedAt: now() });
    await db.collection("supplier_debts").add({
      ...doc.data(), amount, status: "paid", paidAt: now(), paidBy: req.uid, note,
      type: "partial_payment", createdAt: now(),
    });
  }
  await addAuditLog("supplier_debt_pay", req.uid!, { debtId, amount });
  res.json({ success: true });
});

// ============================================================
// FINANCE DEBTS (Installment contracts)
// ============================================================
app.get("/finance-debts", async (req: AuthRequest, res) => {
  const { companyId, status } = req.query;
  let ref: admin.firestore.Query = db.collection("finance_debts").orderBy("createdAt", "desc").limit(200);
  if (companyId) ref = db.collection("finance_debts").where("companyId", "==", companyId);
  if (status) ref = db.collection("finance_debts").where("status", "==", status);
  res.json(await queryToJson(ref));
});

app.post("/finance-debts", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const ref = await db.collection("finance_debts").add({
    ...req.body, status: "pending", createdBy: req.uid, createdAt: now(), updatedAt: now(),
  });
  res.json({ success: true, id: ref.id });
});

app.get("/finance-debts/summary", async (req: AuthRequest, res) => {
  const snap = await db.collection("finance_debts").get();
  const debts = snap.docs.map(d => d.data());
  const totalPending = debts.filter(d => d.status === "pending").reduce((s, d) => s + (d.amount || 0), 0);
  const totalReceived = debts.filter(d => d.status === "received").reduce((s, d) => s + (d.amount || 0), 0);
  res.json({ totalPending, totalReceived, count: debts.length });
});

app.post("/finance-debts/pay", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const { debtId, amount, note } = req.body;
  const doc = await db.collection("finance_debts").doc(debtId).get();
  if (!doc.exists) return res.status(404).json({ error: "Debt not found" });
  await doc.ref.update({ status: "received", receivedAmount: amount, receivedAt: now(), note, updatedAt: now() });
  await db.collection("revenue").add({
    type: "finance_payment", amount, date: new Date().toISOString().split("T")[0], createdAt: now(),
  });
  await addAuditLog("finance_debt_receive", req.uid!, { debtId, amount });
  res.json({ success: true });
});

// ============================================================
// CUSTOMERS
// ============================================================
app.get("/customers", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("customers").orderBy("name")));
});

app.post("/customers", async (req: AuthRequest, res) => {
  const ref = await db.collection("customers").add({ ...req.body, createdAt: now(), updatedAt: now() });
  res.json({ success: true, id: ref.id });
});

app.get("/customers/:id", async (req: AuthRequest, res) => {
  const doc = await db.collection("customers").doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: "Customer not found" });
  res.json(docToJson(doc));
});

app.put("/customers/:id", async (req: AuthRequest, res) => {
  await db.collection("customers").doc(req.params.id).update({ ...req.body, updatedAt: now() });
  res.json({ success: true });
});

// ============================================================
// CUSTOMER DEBTS
// ============================================================
app.get("/customer-debts", async (req: AuthRequest, res) => {
  const { customerId, status } = req.query;
  let ref: admin.firestore.Query = db.collection("customer_debts").orderBy("createdAt", "desc").limit(200);
  if (customerId) ref = db.collection("customer_debts").where("customerId", "==", customerId);
  if (status) ref = db.collection("customer_debts").where("status", "==", status);
  res.json(await queryToJson(ref));
});

app.post("/customer-debts", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const ref = await db.collection("customer_debts").add({
    ...req.body, status: "unpaid", reminderCount: 0, createdBy: req.uid, createdAt: now(), updatedAt: now(),
  });
  res.json({ success: true, id: ref.id });
});

app.get("/customer-debts/summary", async (req: AuthRequest, res) => {
  const snap = await db.collection("customer_debts").get();
  const debts = snap.docs.map(d => d.data());
  const totalUnpaid = debts.filter(d => d.status === "unpaid").reduce((s, d) => s + (d.amount || 0), 0);
  const totalPaid = debts.filter(d => d.status === "paid").reduce((s, d) => s + (d.amount || 0), 0);
  const overdueCount = debts.filter(d => d.status === "unpaid" && d.dueDate && new Date(d.dueDate) < new Date()).length;
  res.json({ totalUnpaid, totalPaid, count: debts.length, overdueCount });
});

app.post("/customer-debts/pay", requireRole("manager", "admin", "ceo"), async (req: AuthRequest, res) => {
  const { debtId, amount, note } = req.body;
  const doc = await db.collection("customer_debts").doc(debtId).get();
  if (!doc.exists) return res.status(404).json({ error: "Debt not found" });
  const currentAmount = doc.data()?.amount || 0;
  if (amount >= currentAmount) {
    await doc.ref.update({ status: "paid", paidAmount: amount, paidAt: now(), note, updatedAt: now() });
  } else {
    await doc.ref.update({ amount: currentAmount - amount, updatedAt: now() });
  }
  await db.collection("revenue").add({
    type: "customer_payment", amount, date: new Date().toISOString().split("T")[0], createdAt: now(),
  });
  await addAuditLog("customer_debt_pay", req.uid!, { debtId, amount });
  res.json({ success: true });
});

app.post("/customer-debts/:id/remind", async (req: AuthRequest, res) => {
  const doc = await db.collection("customer_debts").doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: "Debt not found" });
  const data = doc.data()!;
  await doc.ref.update({
    reminderCount: (data.reminderCount || 0) + 1,
    lastRemindedAt: now(),
    updatedAt: now(),
  });
  // Log the reminder
  await db.collection("notifications").add({
    userId: req.uid, type: "debt_reminder",
    title: `Đã nhắc nợ khách hàng`,
    message: `Số tiền: ${(data.amount || 0).toLocaleString("vi-VN")}đ - Lần nhắc thứ ${(data.reminderCount || 0) + 1}`,
    read: false, createdAt: now(),
  });
  res.json({ success: true, reminderCount: (data.reminderCount || 0) + 1 });
});

// ============================================================
// DEBT OVERVIEW (Combined dashboard)
// ============================================================
app.get("/debt-overview", async (req: AuthRequest, res) => {
  const [supplierSnap, financeSnap, customerSnap] = await Promise.all([
    db.collection("supplier_debts").get(),
    db.collection("finance_debts").get(),
    db.collection("customer_debts").get(),
  ]);
  const supplierDebts = supplierSnap.docs.map(d => d.data());
  const financeDebts = financeSnap.docs.map(d => d.data());
  const customerDebts = customerSnap.docs.map(d => d.data());

  res.json({
    supplier: {
      totalDebt: supplierDebts.filter(d => d.status === "unpaid").reduce((s, d) => s + (d.amount || 0), 0),
      totalPaid: supplierDebts.filter(d => d.status === "paid").reduce((s, d) => s + (d.amount || 0), 0),
      count: supplierDebts.length,
    },
    finance: {
      totalPending: financeDebts.filter(d => d.status === "pending").reduce((s, d) => s + (d.amount || 0), 0),
      totalReceived: financeDebts.filter(d => d.status === "received").reduce((s, d) => s + (d.amount || 0), 0),
      count: financeDebts.length,
    },
    customer: {
      totalUnpaid: customerDebts.filter(d => d.status === "unpaid").reduce((s, d) => s + (d.amount || 0), 0),
      totalPaid: customerDebts.filter(d => d.status === "paid").reduce((s, d) => s + (d.amount || 0), 0),
      overdueCount: customerDebts.filter(d => d.status === "unpaid" && d.dueDate && new Date(d.dueDate) < new Date()).length,
      count: customerDebts.length,
    },
  });
});

// ============================================================
// SETTINGS
// ============================================================
app.get("/settings", async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("system_settings")));
});

app.post("/settings", requireRole("admin"), async (req: AuthRequest, res) => {
  const { key, value } = req.body;
  const existing = await db.collection("system_settings").where("key", "==", key).get();
  if (!existing.empty) {
    await existing.docs[0].ref.update({ value, updatedAt: now() });
  } else {
    await db.collection("system_settings").add({ key, value, createdAt: now(), updatedAt: now() });
  }
  await addAuditLog("settings_update", req.uid!, { key });
  res.json({ success: true });
});

// ============================================================
// AUDIT TRAIL
// ============================================================
app.get("/audit", requireRole("admin", "ceo"), async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("audit_trail").orderBy("createdAt", "desc").limit(100)));
});

// ============================================================
// AI AGENTS (Phase 3-4)
// ============================================================
app.get("/ai-agents", requireRole("admin", "ceo"), async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("ai_agents")));
});

app.post("/ai-agents", requireRole("admin"), async (req: AuthRequest, res) => {
  const ref = await db.collection("ai_agents").add({
    ...req.body, status: "active", successRate: 100, totalActions: 0,
    trustLevel: "low", createdAt: now(),
  });
  res.json({ success: true, id: ref.id });
});

app.put("/ai-agents/:id/toggle", requireRole("admin"), async (req: AuthRequest, res) => {
  const doc = await db.collection("ai_agents").doc(req.params.id).get();
  const current = doc.data()?.status;
  await doc.ref.update({ status: current === "active" ? "paused" : "active", updatedAt: now() });
  res.json({ success: true });
});

// ============================================================
// AI IMPROVEMENTS (Phase 3)
// ============================================================
app.get("/ai-improvements", requireRole("admin", "ceo"), async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("ai_improvements").orderBy("createdAt", "desc").limit(50)));
});

app.post("/ai-improvements", requireRole("admin"), async (req: AuthRequest, res) => {
  const ref = await db.collection("ai_improvements").add({
    ...req.body, status: "proposed", createdAt: now(),
  });
  res.json({ success: true, id: ref.id });
});

app.put("/ai-improvements/:id/approve", requireRole("admin", "ceo"), async (req: AuthRequest, res) => {
  await db.collection("ai_improvements").doc(req.params.id).update({
    status: "approved", approvedBy: req.uid, approvedAt: now(),
  });
  res.json({ success: true });
});

// ============================================================
// TRUST & GOVERNANCE (Phase 4)
// ============================================================
app.get("/trust-tiers", requireRole("admin", "ceo"), async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("trust_tiers")));
});

app.post("/trust-tiers", requireRole("admin"), async (req: AuthRequest, res) => {
  const ref = await db.collection("trust_tiers").add({ ...req.body, createdAt: now() });
  res.json({ success: true, id: ref.id });
});

// ============================================================
// ORCHESTRATOR — AI Multi-Agent (Phase 4)
// ============================================================
app.post("/orchestrator/plan-task", requireRole("admin", "ceo"), async (req: AuthRequest, res) => {
  try {
    const { taskDescription } = req.body;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Bạn là AI Orchestrator. Phân tích task và tạo kế hoạch thực hiện gồm các bước cụ thể. Trả lời JSON: {steps: [{title, description, agent, estimatedMinutes}], reasoning: string}" },
        { role: "user", content: taskDescription },
      ],
      max_tokens: 800,
    });
    const content = completion.choices[0]?.message?.content || "{}";
    let plan;
    try { plan = JSON.parse(content); } catch { plan = { steps: [], reasoning: content }; }
    await db.collection("orchestrator_plans").add({
      taskDescription, plan, createdBy: req.uid, createdAt: now(),
    });
    res.json({ success: true, plan });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.post("/orchestrator/analyze-patterns", requireRole("admin", "ceo"), async (req: AuthRequest, res) => {
  try {
    const [tasks, attendance, alerts] = await Promise.all([
      queryToJson(db.collection("tasks").orderBy("createdAt", "desc").limit(100)),
      queryToJson(db.collection("attendance").orderBy("checkIn", "desc").limit(100)),
      queryToJson(db.collection("alerts").orderBy("createdAt", "desc").limit(50)),
    ]);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Phân tích patterns từ dữ liệu vận hành. Tìm xu hướng, anomalies, và đề xuất cải tiến. Trả lời tiếng Việt." },
        { role: "user", content: `Tasks: ${JSON.stringify(tasks.slice(0, 30))}\nAttendance: ${JSON.stringify(attendance.slice(0, 30))}\nAlerts: ${JSON.stringify(alerts.slice(0, 20))}` },
      ],
      max_tokens: 1000,
    });
    const analysis = completion.choices[0]?.message?.content || "Không đủ dữ liệu";
    await db.collection("pattern_analyses").add({ analysis, createdBy: req.uid, createdAt: now() });
    res.json({ success: true, analysis, count: tasks.length + attendance.length + alerts.length });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.get("/orchestrator/ceo-ops", async (req: AuthRequest, res) => {
  const [employees, tasks, alerts, attendance, revenue, agents, improvements] = await Promise.all([
    db.collection("users").count().get(),
    db.collection("tasks").count().get(),
    db.collection("alerts").where("status", "==", "active").count().get(),
    db.collection("attendance").where("date", "==", new Date().toISOString().split("T")[0]).count().get(),
    db.collection("revenue").orderBy("date", "desc").limit(30).get(),
    db.collection("ai_agents").count().get(),
    db.collection("ai_improvements").count().get(),
  ]);
  const revenueData = revenue.docs.map(d => d.data());
  const totalRevenue = revenueData.reduce((s, r) => s + (r.amount || 0), 0);
  res.json({
    totalEmployees: employees.data().count,
    totalTasks: tasks.data().count,
    activeAlerts: alerts.data().count,
    todayAttendance: attendance.data().count,
    totalRevenue,
    totalAgents: agents.data().count,
    totalImprovements: improvements.data().count,
    revenueData: revenueData.slice(0, 7),
  });
});

// ============================================================
// SCHEDULED JOBS
// ============================================================
app.get("/scheduled-jobs", requireRole("admin", "ceo"), async (req: AuthRequest, res) => {
  res.json(await queryToJson(db.collection("scheduled_jobs")));
});

app.put("/scheduled-jobs/:id/toggle", requireRole("admin"), async (req: AuthRequest, res) => {
  const doc = await db.collection("scheduled_jobs").doc(req.params.id).get();
  const current = doc.data()?.enabled;
  await doc.ref.update({ enabled: !current, updatedAt: now() });
  res.json({ success: true });
});

app.post("/scheduled-jobs/:id/run", requireRole("admin"), async (req: AuthRequest, res) => {
  const doc = await db.collection("scheduled_jobs").doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: "Job not found" });
  await doc.ref.update({ lastRun: now(), runCount: (doc.data()?.runCount || 0) + 1 });
  res.json({ success: true, message: `Job ${doc.data()?.name} executed` });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[API Error]", err);
  res.status(err?.status || 500).json({ error: err?.message || "Internal server error" });
});

// ============================================================
// EXPORT AS FIREBASE FUNCTION
// ============================================================
export const api = onRequest(app);

// ============================================================
// SCHEDULED FUNCTIONS (Firebase Cloud Scheduler)
// ============================================================
export const morningReminder = onSchedule({ schedule: "50 7 * * *", timeZone: "Asia/Ho_Chi_Minh" }, async () => {
  const users = await db.collection("users").get();
  const batch = db.batch();
  users.docs.forEach(doc => {
    const ref = db.collection("notifications").doc();
    batch.set(ref, {
      userId: doc.id, type: "reminder",
      title: "Nhắc nhở chấm công",
      message: "Đã 7:50 sáng, đừng quên chấm công nhé!",
      read: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  console.log(`[Scheduler] Morning reminder sent to ${users.size} users`);
});

export const eveningCheckout = onSchedule({ schedule: "0 18 * * *", timeZone: "Asia/Ho_Chi_Minh" }, async () => {
  const today = new Date().toISOString().split("T")[0];
  const unchecked = await db.collection("attendance")
    .where("date", "==", today)
    .where("checkOut", "==", null)
    .get();
  if (!unchecked.empty) {
    const batch = db.batch();
    unchecked.docs.forEach(doc => {
      const ref = db.collection("notifications").doc();
      batch.set(ref, {
        userId: doc.data().userId, type: "reminder",
        title: "Nhắc nhở checkout",
        message: "Đã 18:00, bạn chưa checkout. Hãy checkout trước khi về!",
        read: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
  console.log(`[Scheduler] Evening checkout reminder: ${unchecked.size} users`);
});

export const dailyKpiSync = onSchedule({ schedule: "0 23 * * *", timeZone: "Asia/Ho_Chi_Minh" }, async () => {
  const today = new Date().toISOString().split("T")[0];
  const [attendance, tasks, revenue] = await Promise.all([
    db.collection("attendance").where("date", "==", today).count().get(),
    db.collection("tasks").where("status", "==", "completed").count().get(),
    db.collection("revenue").where("date", "==", today).get(),
  ]);
  const totalRevenue = revenue.docs.reduce((s, d) => s + (d.data().amount || 0), 0);
  await db.collection("daily_kpi").add({
    date: today,
    attendanceCount: attendance.data().count,
    completedTasks: tasks.data().count,
    revenue: totalRevenue,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`[Scheduler] Daily KPI synced for ${today}`);
});

export const weeklyReport = onSchedule({ schedule: "0 9 * * 1", timeZone: "Asia/Ho_Chi_Minh" }, async () => {
  // Generate weekly summary for chairman
  const chairmanSnap = await db.collection("users").where("email", "==", CHAIRMAN_EMAIL).get();
  if (!chairmanSnap.empty) {
    await db.collection("notifications").add({
      userId: chairmanSnap.docs[0].id, type: "report",
      title: "Báo cáo tuần",
      message: "Báo cáo tổng hợp tuần đã sẵn sàng. Xem tại Dashboard.",
      read: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log("[Scheduler] Weekly report generated");
});

export const debtReminder = onSchedule({ schedule: "0 9 * * *", timeZone: "Asia/Ho_Chi_Minh" }, async () => {
  // Check overdue customer debts
  const now = new Date();
  const debts = await db.collection("customer_debts").where("status", "==", "unpaid").get();
  let overdueCount = 0;
  for (const doc of debts.docs) {
    const data = doc.data();
    if (data.dueDate && new Date(data.dueDate) < now) {
      overdueCount++;
    }
  }
  if (overdueCount > 0) {
    // Notify chairman
    const chairmanSnap = await db.collection("users").where("email", "==", CHAIRMAN_EMAIL).get();
    if (!chairmanSnap.empty) {
      await db.collection("notifications").add({
        userId: chairmanSnap.docs[0].id, type: "debt_alert",
        title: `${overdueCount} khoản nợ quá hạn`,
        message: `Có ${overdueCount} khoản công nợ khách hàng đã quá hạn thanh toán.`,
        read: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
  console.log(`[Scheduler] Debt reminder: ${overdueCount} overdue debts`);
});
