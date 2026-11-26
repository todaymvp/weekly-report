/* 极简 API 封装：统一错误处理 + 同源 Cookie 凭据 */
(function () {
  'use strict';

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  async function request(path, options) {
    const opts = Object.assign({ method: 'GET', credentials: 'same-origin' }, options || {});
    if (opts.body !== undefined && !(opts.body instanceof FormData)) {
      opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
      opts.body = JSON.stringify(opts.body);
    }
    let res;
    try {
      res = await fetch('/api' + path, opts);
    } catch (e) {
      throw new ApiError('网络异常，请检查连接', 0);
    }
    if (res.status === 204) return {};

    let data = {};
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }
    }
    if (!res.ok) {
      if (res.status === 401 && window.__onUnauthorized) window.__onUnauthorized();
      throw new ApiError(data.error || `请求失败（${res.status}）`, res.status);
    }
    return data;
  }

  window.api = {
    get: (p) => request(p),
    post: (p, body) => request(p, { method: 'POST', body: body || {} }),
    put: (p, body) => request(p, { method: 'PUT', body: body || {} }),
    patch: (p, body) => request(p, { method: 'PATCH', body: body || {} }),
    del: (p) => request(p, { method: 'DELETE' }),
    upload: (p, formData) => request(p, { method: 'POST', body: formData })
  };
  window.ApiError = ApiError;
})();
