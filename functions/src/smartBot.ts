import * as admin from "firebase-admin";

export type SmartBotUser = {
  uid?: string;
  userName?: string;
  userRole?: string;
  userEmail?: string;
};

export type SmartBotContext = {
  intent: string;
  summary: Record<string, unknown>;
  memory: Array<Record<string, unknown>>;
  recentOps: Record<string, unknown>;
};

const nowIso = () => new Date().toISOString();
const todayKey = () => new Date().toISOString().split("T")[0];

function normalizeText(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function detectSmartBotIntent(message: unknown): string {
  const text = normalizeText(message);
  if (/công nợ|nợ|quá hạn|thu tiền|khách nợ/.test(text)) return "debt";
  if (/kho|tồn|imei|hàng|sản phẩm|nhập|xuất/.test(text)) return "inventory";
  if (/nhân viên|ca|chấm công|kpi|lương|đi trễ/.test(text)) return "hr";
  if (/doanh thu|lãi|lỗ|bán|đơn|profit|revenue/.test(text)) return "sales";
  if (/bảo hành|sửa|lỗi|ticket/.test(text)) return "warranty";
  if (/kế hoạch|plan|việc cần làm|ưu tiên|hôm nay/.test(text)) return "planning";
  return "general";
}

async function safeCount(db: admin.firestore.Firestore, collection: string, filters: Array<[string, FirebaseFirestore.WhereFilterOp, unknown]> = []) {
  try {
    let ref: FirebaseFirestore.Query = db.collection(collection);
    for (const [field, op, value] of filters) ref = ref.where(field, op, value);
    const snap = await ref.count().get();
    return snap.data().count || 0;
  } catch {
    return null;
  }
}

async function safeRecent(db: admin.firestore.Firestore, collection: string, orderBy: string, limit = 5) {
  try {
    const snap = await db.collection(collection).orderBy(orderBy, "desc").limit(limit).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch {
    return [];
  }
}

export async function buildSmartBotContext(db: admin.firestore.Firestore, user: SmartBotUser, message: unknown): Promise<SmartBotContext> {
  const intent = detectSmartBotIntent(message);
  const today = todayKey();

  const [
    totalEmployees,
    activeAlerts,
    pendingTasks,
    todayAttendance,
    overdueCustomerDebts,
    inStockImeis,
    recentMemory,
    recentTasks,
    recentAlerts,
    recentRevenue,
  ] = await Promise.all([
    safeCount(db, "users"),
    safeCount(db, "alerts", [["status", "==", "active"]]),
    safeCount(db, "tasks", [["status", "==", "pending"]]),
    safeCount(db, "attendance", [["date", "==", today]]),
    safeCount(db, "customer_debts", [["status", "==", "unpaid"]]),
    safeCount(db, "imei_items", [["status", "==", "in_stock"]]),
    safeRecent(db, "ai_bot_memory", "createdAt", 6),
    safeRecent(db, "tasks", "createdAt", 5),
    safeRecent(db, "alerts", "createdAt", 5),
    safeRecent(db, "revenue", "createdAt", 7),
  ]);

  return {
    intent,
    summary: {
      today,
      user: {
        uid: user.uid,
        name: user.userName,
        role: user.userRole,
        email: user.userEmail,
      },
      totalEmployees,
      activeAlerts,
      pendingTasks,
      todayAttendance,
      overdueCustomerDebts,
      inStockImeis,
      generatedAt: nowIso(),
    },
    memory: recentMemory,
    recentOps: {
      tasks: recentTasks,
      alerts: recentAlerts,
      revenue: recentRevenue,
    },
  };
}

export function buildSmartBotSystemPrompt(user: SmartBotUser, context: SmartBotContext): string {
  return `Bạn là CEO Trung Kim AI Bot nâng cấp cho Di Động Trung Hậu Kim Dung.
Vai trò: trợ lý vận hành cấp Chủ tịch/CEO, ưu tiên câu trả lời hành động được ngay.
Người dùng: ${user.userName || "User"} (${user.userRole || "staff"}).
Intent hiện tại: ${context.intent}.

Nguyên tắc:
- Trả lời tiếng Việt, xưng hô thân mật nhưng rõ việc.
- Ưu tiên số liệu trong CONTEXT nếu có.
- Nếu thiếu dữ liệu, nói rõ thiếu gì và đề xuất bước tiếp theo.
- Không bịa số liệu.
- Với câu hỏi vận hành, luôn kết thúc bằng 1-3 hành động đề xuất.
- Với việc nhạy cảm như xoá dữ liệu, phân quyền, deploy, thanh toán: chỉ đề xuất, không tự xác nhận đã làm.

CONTEXT JSON:
${JSON.stringify(context, null, 2)}`;
}

export function normalizeConversationHistory(history: unknown) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-12)
    .map((item) => {
      const role = item?.role === "assistant" ? "assistant" : "user";
      const content = String(item?.content || "").slice(0, 4000);
      return { role, content };
    })
    .filter((item) => item.content.trim());
}

export async function saveSmartBotMemory(db: admin.firestore.Firestore, payload: {
  userId?: string;
  userName?: string;
  intent: string;
  message: string;
  reply: string;
  contextSummary: Record<string, unknown>;
}) {
  await db.collection("ai_bot_memory").add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
