export function ok(res, data, message = 'ok') {
  return res.json({ code: 0, data, message });
}

export function fail(res, status, message) {
  return res.status(status).json({ code: 1, data: null, message });
}