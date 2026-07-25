module.exports = async function handler(req, res) {
  try {
    var code = "";

    if (req.query && req.query.code) {
      code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    }

    code = String(code || "").trim();

    if (!code) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Не передан короткий код рекомендации.");
      return;
    }

    var getLinkEndpoint =
      "https://api.directual.com/good/api/v5/data/recommendations/get_short_patient_link" +
      "?appID=d4eb128c-0d11-47eb-84e8-c3cc3c6cc897" +
      "&n=" + encodeURIComponent(code);

    var response = await fetch(getLinkEndpoint, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Directual endpoint get_short_patient_link ответил с ошибкой.");
      return;
    }

    var data = await response.json();

    var item = null;

    if (data && Array.isArray(data.payload) && data.payload.length > 0) {
      item = data.payload[0];
    } else if (data && Array.isArray(data.result) && data.result.length > 0) {
      item = data.result[0];
    } else if (data && Array.isArray(data.data) && data.data.length > 0) {
      item = data.data[0];
    }

    if (!item || !item.patient_link) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Рекомендация по этому короткому коду не найдена.");
      return;
    }

    var targetLink = String(item.patient_link || "").trim().replace(/&amp;/g, "&");

    var url;

    try {
      url = new URL(targetLink);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("patient_link имеет неправильный формат URL.");
      return;
    }

    if (
      url.hostname !== "noya.directual.app" ||
      url.pathname.indexOf("/cabinet-patient/") !== 0
    ) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Найденная patient_link имеет неправильный формат.");
      return;
    }

    url.searchParams.set("short_code", code);

    if (!url.searchParams.get("doctor_ref") && item.doctor_ref_code) {
      url.searchParams.set("doctor_ref", String(item.doctor_ref_code).trim());
    }

    if (!url.searchParams.get("patient_phone") && item.patient_phone) {
      url.searchParams.set("patient_phone", String(item.patient_phone).trim());
    }

    if (!url.searchParams.get("patient_email") && item.patient_email) {
      url.searchParams.set("patient_email", String(item.patient_email).trim());
    }

    targetLink = url.toString();

    var parts = url.pathname.split("/").filter(Boolean);
    var recId = "";

    var idx = parts.indexOf("cabinet-patient");
    if (idx >= 0 && parts[idx + 1]) {
      recId = decodeURIComponent(parts[idx + 1]);
    }

    var token = url.searchParams.get("token") || recId;
    var doctorRef = url.searchParams.get("doctor_ref") || "";
    var patientPhone = url.searchParams.get("patient_phone") || "";
    var patientEmail = url.searchParams.get("patient_email") || "";

    if (!recId || !token || !doctorRef) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("В финальной ссылке не хватает recId, token или doctor_ref.");
      return;
    }

    var now = new Date();

    var openedAtText =
      now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0") + " " +
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0");

    var accessPayload = {
      id: recId,

      rec_id: recId,
      token: token,
      patient_access_token: token,

      doctor_ref_code: doctorRef,
      source_recommendation: recId,

      patient_number: code,
      short_code: code,

      patient_phone: patientPhone,
      phone: patientPhone,

      patient_email: patientEmail,
      email: patientEmail,

      patient_link: targetLink,
      access_granted: true,
      status: "opened",
      link_open_status: "Ссылка пациентом открыта",
      link_opened_at_text: openedAtText
    };

    var accessEndpoint =
      "https://api.directual.com/good/api/v5/data/patient_access_request/patientaccessrequest" +
      "?appID=d4eb128c-0d11-47eb-84e8-c3cc3c6cc897";

    var accessResponse = await fetch(accessEndpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(accessPayload)
    });

    if (!accessResponse.ok) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Не удалось создать patient_access_request через Vercel.");
      return;
    }

    res.statusCode = 302;
    res.setHeader("Location", targetLink);
    res.setHeader("Cache-Control", "no-store");
    res.end();

  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Ошибка сервиса редиректа.");
  }
};
