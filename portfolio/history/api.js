// 서버(/api/*) 호출 도우미 — 로그인/비밀번호 없음 (공개 방식)
(function () {
  async function request(path, opts) {
    opts = opts || {};
    var headers = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    var res;
    try {
      res = await fetch(path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch (e) {
      var netErr = new Error('서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.');
      netErr.status = 0;
      throw netErr;
    }

    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var err = new Error((data && data.error) || '요청에 실패했어요. (' + res.status + ')');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  window.Api = {
    listCampaigns: function () { return request('/api/campaigns'); },
    addCampaign: function (b) { return request('/api/campaigns', { method: 'POST', body: b }); },
    updateCampaign: function (id, b) { return request('/api/campaigns?id=' + encodeURIComponent(id), { method: 'PATCH', body: b }); },
    deleteCampaign: function (id) { return request('/api/campaigns?id=' + encodeURIComponent(id), { method: 'DELETE' }); },
    listHistories: function () { return request('/api/histories'); },
    addHistory: function (b) { return request('/api/histories', { method: 'POST', body: b }); },
    deleteHistory: function (id) { return request('/api/histories?id=' + encodeURIComponent(id), { method: 'DELETE' }); },
  };
})();
