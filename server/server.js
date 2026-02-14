require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');

const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// 세션 스토어 설정
let sessionStore;
try {
    const ConnectSQLite3 = require('connect-sqlite3')(session);
    const fs = require('fs');
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    sessionStore = new ConnectSQLite3({
        db: 'sessions.db',
        dir: dataDir
    });
} catch (e) {
    console.warn('connect-sqlite3 로드 실패, 메모리 세션 사용:', e.message);
    sessionStore = undefined;
}

// 프록시 뒤에서 HTTPS 인식 (Cloudflare, nginx 등)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// 미들웨어
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션
app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'go-dutch-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7일
    }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// 라우트
app.use('/auth', authRouter);
app.use('/api', apiRouter);

// 정적 파일
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA 폴백 (API/auth 경로 제외)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/auth')) {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Go Dutch 서버 실행 중: http://localhost:${PORT}`);
    console.log(`Google 로그인: ${process.env.GOOGLE_CLIENT_ID ? '설정됨' : '미설정 (.env 확인)'}`);
    console.log(`Naver 로그인:  ${process.env.NAVER_CLIENT_ID ? '설정됨' : '미설정 (.env 확인)'}`);
});
