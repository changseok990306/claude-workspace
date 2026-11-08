// 예시 데이터 — 화면을 처음 둘러볼 때 쓰는 가짜 데이터입니다. (오늘 날짜 기준으로 생성)
(function () {
  'use strict';
  var A = window.Ads = window.Ads || {};
  var calc = A.calc;

  A.buildSample = function (now) {
    var today = calc.today(now);
    var d = function (n) { return calc.addDays(today, n); };

    var campaigns = [
      { id: 's1', name: '예시 · 브랜드 런칭', color: 'indigo' },
      { id: 's2', name: '예시 · 여름 프로모션', color: 'orange' },
      { id: 's3', name: '예시 · 리타게팅', color: 'teal' },
    ];

    var histories = [
      { campaignId: 's1', date: d(-44), content: '런칭 캠페인 시작. 메인 배너 3종, 타겟 25-34.' },
      { campaignId: 's1', date: d(-20), content: '예산 20% 증액 승인. 타겟 연령대를 25-39로 확대.' },
      { campaignId: 's1', date: d(-3), content: '메인 배너 A/B 테스트 시작. 변형 B 클릭률이 초반에 더 높음.' },
      { campaignId: 's2', date: d(-30), content: '여름 프로모션 오픈. 배너 5종, 이메일 1차 발송.' },
      { campaignId: 's2', date: d(-12), content: '이메일 2차 발송. 제목에 할인율을 넣었더니 오픈율 상승.' },
      { campaignId: 's3', date: d(-9), content: '픽셀 이벤트 누락 발견 → 개발팀에 수정 요청.' },
      { campaignId: 's3', date: d(-1), content: '소재 3종 교체. 일 예산 상한 조정 필요.' },
    ];

    var check = function (list, doneCount) {
      return list.map(function (t, i) { return { text: t, done: i < doneCount }; });
    };
    var base = ['규격·사이즈 확인', '문구 검수', '랜딩 링크 확인', 'UTM 파라미터 확인', '승인 완료'];
    var creatives = [
      { campaignId: 's1', title: '메인 배너 A (1200×628)', type: '배너', status: 'live', memo: '기본 안', checklist: check(base, 5) },
      { campaignId: 's1', title: '메인 배너 B (1200×628)', type: '배너', status: 'live', memo: 'A/B 테스트용 변형', checklist: check(base, 5) },
      { campaignId: 's1', title: '런칭 영상 15초', type: '영상', status: 'ready', memo: '자막 최종본 대기', checklist: check(base, 2) },
      { campaignId: 's2', title: '할인 이메일 3차', type: '이메일', status: 'ready', memo: '', checklist: check(base, 0) },
      { campaignId: 's3', title: '장바구니 리마인드 배너', type: '배너', status: 'live', memo: '', checklist: check(base, 4) },
      { campaignId: 's2', title: '봄 시즌 배너 (종료)', type: '배너', status: 'done', memo: '', checklist: check(base, 5) },
    ];

    return { campaigns: campaigns, histories: histories, creatives: creatives };
  };
})();
