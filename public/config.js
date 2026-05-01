// public/config.js
window.THKD = window.THKD || {};

// DÁN LINK WEB APP CỦA ANH VÀO ĐÂY
window.THKD.GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwLgxaWcYdc6PL8VNOcwkCzW4zjTd1GcHj270laq0oCjUzYRPMd2vNpvhzn_w5Y8K-9gQ/exec";

// Call API theo action (tránh CORS preflight bằng form-urlencoded)
window.THKD.callApi = async function(action, payload){
  const body = new URLSearchParams();
  body.set("action", action);
  body.set("payload", JSON.stringify(payload || {}));

  const res = await fetch(window.THKD.GAS_WEBAPP_URL, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body
  });

  const txt = await res.text();
  try { return JSON.parse(txt); }
  catch(e){ return { ok:false, message:"Bad JSON response", raw: txt }; }
};
