// 인증 상태 확인 및 UI 초기화
(async function initAuth() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.querySelector('.container');
    const userInfo = document.getElementById('user-info');

    try {
        const response = await fetch('/auth/me', { credentials: 'same-origin' });

        if (!response.ok) {
            // 미로그인: 로그인 화면 표시
            loginScreen.style.display = 'flex';
            appContainer.style.display = 'none';
            return;
        }

        const user = await response.json();

        // 로그인 상태: 앱 표시
        loginScreen.style.display = 'none';
        appContainer.style.display = 'block';

        // 헤더 사용자 정보 업데이트
        userInfo.style.display = 'flex';
        document.getElementById('user-name').textContent = user.email;

        const avatar = document.getElementById('user-avatar');
        if (user.profile_image) {
            avatar.src = user.profile_image;
            avatar.style.display = 'block';
        }

        // 관리자 링크
        if (user.role === 'admin') {
            const adminLink = document.getElementById('admin-link');
            if (adminLink) adminLink.style.display = 'inline-block';
        }

        // 로그아웃 버튼
        document.getElementById('logout-btn').addEventListener('click', async () => {
            await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
            location.reload();
        });

        // 앱에서 사용할 현재 사용자 정보 저장
        window.currentUser = user;

        // 앱 초기화 이벤트 발송
        document.dispatchEvent(new CustomEvent('authReady', { detail: user }));

    } catch (e) {
        console.error('인증 확인 실패:', e);
        loginScreen.style.display = 'flex';
        appContainer.style.display = 'none';
    }
})();
