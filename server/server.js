require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// 프로덕션에서 SESSION_SECRET 필수
if (isProduction && !process.env.SESSION_SECRET) {
    console.error('ERROR: SESSION_SECRET 환경변수가 설정되지 않았습니다. 프로덕션에서는 필수입니다.');
    process.exit(1);
}

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
if (isProduction) {
    app.set('trust proxy', 1);
}

// 보안 헤더 (helmet)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "https:", "data:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: isProduction ? [] : null,
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: isProduction,
}));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '인증 요청이 너무 많습니다. 잠시 후 다시 시도하세요.' }
});

// 미들웨어
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 세션
app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'go-dutch-dev-secret-CHANGE-IN-PRODUCTION',
    resave: false,
    saveUninitialized: false,
    name: 'gd.sid',
    cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7일
    }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// 라우트 (rate limiting 적용)
// /auth/me는 페이지 로드마다 호출되는 상태 확인이므로 rate limit 제외
app.get('/auth/me', (req, res, next) => next());
app.use('/auth', authLimiter, authRouter);
app.use('/api', apiLimiter, apiRouter);

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
