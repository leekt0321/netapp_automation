async function parseJsonResponse(response) {
  const payload = await response.json();
  return { response, payload };
}

export async function getJson(url, options = {}) {
  return parseJsonResponse(await fetch(url, { credentials: "same-origin", ...options }));
}

export async function sendJson(url, method, body, options = {}) {
  return parseJsonResponse(
    await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      body: JSON.stringify(body),
      ...options,
    }),
  );
}

export async function postJson(url, body, options = {}) {
  return sendJson(url, "POST", body, options);
}

export async function putJson(url, body, options = {}) {
  return sendJson(url, "PUT", body, options);
}

export async function deleteJson(url, body, options = {}) {
  const requestOptions = { ...options };
  if (body !== undefined) {
    requestOptions.headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    requestOptions.body = JSON.stringify(body);
  }
  return parseJsonResponse(
    await fetch(url, {
      method: "DELETE",
      credentials: "same-origin",
      ...requestOptions,
    }),
  );
}

export async function postForm(url, formData, options = {}) {
  return parseJsonResponse(
    await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      body: formData,
      ...options,
    }),
  );
}
