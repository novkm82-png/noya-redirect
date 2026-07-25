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
      res.end("Не передан код рекомендации.");
      return;
    }

    var endpointUrl =
      "https://api.directual.com/good/api/v5/data/recommendations/get_short_patient_link" +
      "?appID=d4eb128c-0d11-47eb-84e8-c3cc3c6cc897" +
      "&n=" + encodeURIComponent(code);

    var response = await fetch(endpointUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Directual endpoint ответил с ошибкой.");
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

    if (!item) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Рекомендация по этому короткому коду не найдена.");
      return;
    }

    var recId = String(item.id || "").trim();
    var token = String(item.patient_access_token || recId).trim();
    var doctorRef = String(item.doctor_ref_code || "").trim();
    var phone = String(item.patient_phone || item.phone || "").trim();
    var email = String(item.patient_email || item.email || "").trim();

    var targetLink = "";

    if (recId && token) {
      targetLink =
        "https://noya.directual.app/cabinet-patient/" +
        encodeURIComponent(recId) +
        "?token=" + encodeURIComponent(token) +
        "&doctor_ref=" + encodeURIComponent(doctorRef) +
        "&patient_phone=" + encodeURIComponent(phone) +
        "&patient_email=" + encodeURIComponent(email) +
        "&short_code=" + encodeURIComponent(code) +
        "&utm_source=doctor&utm_medium=referral&utm_campaign=recommendation";
    } else if (item.patient_link) {
      targetLink = String(item.patient_link || "").trim().replace(/&amp;/g, "&");

      var separator = targetLink.indexOf("?") >= 0 ? "&" : "?";

      if (targetLink.indexOf("short_code=") < 0) {
        targetLink = targetLink + separator + "short_code=" + encodeURIComponent(code);
      }
    }

    if (!targetLink || targetLink.indexOf("https://noya.directual.app/cabinet-patient/") !== 0) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Найденная ссылка пациента имеет неправильный формат.");
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
