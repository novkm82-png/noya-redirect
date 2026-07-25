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

    var targetLink = "";

    /*
      Главное изменение:
      сначала используем уже готовую patient_link из Directual.
      Не собираем ссылку заново из doctor_ref_code / patient_phone,
      потому что если эти поля не отдаются endpoint, они становятся пустыми.
    */
    if (item.patient_link) {
      targetLink = String(item.patient_link || "").trim().replace(/&amp;/g, "&");
    }

    if (!targetLink) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("В Directual не найдено поле patient_link для этого короткого кода.");
      return;
    }

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
      res.end("Найденная ссылка пациента имеет неправильный формат.");
      return;
    }

    /*
      Добавляем short_code к уже готовой длинной ссылке.
      Все старые параметры doctor_ref, patient_phone, patient_email сохраняются.
    */
    url.searchParams.set("short_code", code);

    /*
      Если endpoint всё-таки отдаёт эти поля отдельно,
      подстрахуемся и дополним ими ссылку, но только если они пустые.
    */
    if (!url.searchParams.get("doctor_ref") && item.doctor_ref_code) {
      url.searchParams.set("doctor_ref", String(item.doctor_ref_code).trim());
    }

    if (!url.searchParams.get("patient_phone") && item.patient_phone) {
      url.searchParams.set("patient_phone", String(item.patient_phone).trim());
    }

    if (!url.searchParams.get("patient_email") && item.patient_email) {
      url.searchParams.set("patient_email", String(item.patient_email).trim());
    }

    /*
      doctor_ref обязателен для вкладки врача.
      Если его нет даже после подстраховки, лучше показать ошибку,
      чем молча открыть страницу и не создать patient_access_request.
    */
    if (!url.searchParams.get("doctor_ref")) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("В patient_link отсутствует doctor_ref. Проверьте формирование patient_link в Directual.");
      return;
    }

    targetLink = url.toString();

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
