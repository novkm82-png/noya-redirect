module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed"
      });
    }

    let body = req.body || {};

    if (typeof body === "string") {
      body = JSON.parse(body || "{}");
    }

const smsAeroEmail = process.env.SMSAERO_EMAIL;
    const smsAeroApiKey = process.env.SMSAERO_API_KEY;
    const smsAeroSign = process.env.SMSAERO_SIGN || "SMSAero";
    const secret = process.env.SMS_GATEWAY_SECRET;

    if (!smsAeroEmail || !smsAeroApiKey) {
      return res.status(500).json({
        ok: false,
        error: "SMS Aero credentials are not configured"
      });
    }

    if (!secret || body.secret !== secret) {
      return res.status(403).json({
        ok: false,
        error: "Forbidden"
      });
}

    function normalizeRuPhone(input) {
      let phone = String(input || "").replace(/\D/g, "");

      if (phone.length === 11 && phone.startsWith("8")) {
        phone = "7" + phone.slice(1);
      }

      if (phone.length === 10) {
        phone = "7" + phone;
      }

      if (!/^7\d{10}$/.test(phone)) {
        throw new Error("Phone must be in format 79991234567");
      }

return phone;
    }

    const phone = normalizeRuPhone(body.phone);
    const type = String(body.type || "").trim();

    let msg = "";

    if (type === "doctor_otp") {
      const code = String(body.code || "").trim();

      if (!/^\d{6}$/.test(code)) {
        throw new Error("Invalid doctor OTP code");
      }

      msg =
"noya.directual.app: код подтверждения врача " +
        code +
        ". Никому не сообщайте код.";
    }

    if (type === "patient_recommendation_link") {
      const link = String(body.link || "").trim();

      if (!/^https?:\/\//.test(link)) {
        throw new Error("Invalid recommendation link");
      }

      msg =
        "noya.directual.app: ваша рекомендация: " +
        link;
    }

if (!msg) {
      throw new Error("Unknown SMS type");
    }

    const auth = Buffer
      .from(`${smsAeroEmail}:${smsAeroApiKey}`)
      .toString("base64");

    const params = new URLSearchParams();
    params.set("number", phone);
    params.set("text", msg);
    params.set("sign", smsAeroSign);

    const smsUrl =
"https://gate.smsaero.ru/v2/sms/send?" + params.toString();

    const smsResponse = await fetch(smsUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json"
      }
    });

    const smsJson = await smsResponse.json();

    return res.status(200).json({
      ok: Boolean(smsJson.success),
      phone: phone,
      type: type,
      message: msg,
      smsaero: smsJson
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || "Unknown error"
    });
  }
};
