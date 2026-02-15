(function() {
    var ua = navigator.userAgent || navigator.vendor || '';

    // 인앱 브라우저 감지: 카카오톡, 라인, 페이스북, 인스타그램, 네이버 등
    var inAppPatterns = [
        'KAKAOTALK', 'Line/', 'FBAN', 'FBAV', 'Instagram',
        'NAVER', 'ZumSearch', 'Whale/', 'Snapchat', 'Daum'
    ];

    var isInApp = inAppPatterns.some(function(pattern) {
        return ua.indexOf(pattern) > -1;
    });

    if (!isInApp) return;

    var currentUrl = location.href;

    // Android: intent scheme으로 기본 브라우저 열기
    if (/android/i.test(ua)) {
        location.href = 'intent://' + currentUrl.replace(/https?:\/\//, '') +
            '#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;end';

        // Chrome이 없을 경우 대비 - 일반 브라우저 fallback
        setTimeout(function() {
            location.href = 'intent://' + currentUrl.replace(/https?:\/\//, '') +
                '#Intent;scheme=https;action=android.intent.action.VIEW;end';
        }, 500);
        return;
    }

    // iOS: Safari로 강제 이동 (location.href 방식)
    if (/iPhone|iPad|iPod/i.test(ua)) {
        // 카카오톡 iOS에서는 아래 방식으로 Safari 열기
        if (ua.indexOf('KAKAOTALK') > -1) {
            location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(currentUrl);
            return;
        }

        // 라인
        if (ua.indexOf('Line/') > -1) {
            location.href = currentUrl + (currentUrl.indexOf('?') > -1 ? '&' : '?') + 'openExternalBrowser=1';
            return;
        }

        // 기타 iOS 인앱 브라우저: 안내 메시지 표시
        document.addEventListener('DOMContentLoaded', function() {
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
                'background:#1a2332;color:#fff;display:flex;align-items:center;' +
                'justify-content:center;z-index:99999;font-family:-apple-system,sans-serif;';
            overlay.innerHTML =
                '<div style="text-align:center;padding:2rem;">' +
                    '<h2 style="margin-bottom:1rem;font-size:1.3rem;">외부 브라우저에서 열어주세요</h2>' +
                    '<p style="color:#aaa;margin-bottom:1.5rem;line-height:1.6;">' +
                        '인앱 브라우저에서는 정상 동작하지 않을 수 있습니다.<br>' +
                        '우측 상단 <b>⋮</b> 또는 <b>...</b> 메뉴에서<br>' +
                        '<b>"기본 브라우저로 열기"</b>를 선택해주세요.' +
                    '</p>' +
                    '<button onclick="navigator.clipboard.writeText(\'' + currentUrl + '\').then(function(){alert(\'URL이 복사되었습니다. 브라우저에 붙여넣기 해주세요.\');})" ' +
                        'style="background:#4a9eff;color:#fff;border:none;padding:0.8rem 1.5rem;' +
                        'border-radius:8px;font-size:1rem;cursor:pointer;">URL 복사하기</button>' +
                '</div>';
            document.body.appendChild(overlay);
        });
        return;
    }
})();
