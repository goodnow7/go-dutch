const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');

const router = express.Router();

// passport-naver-v2 or passport-naver 지원
let NaverStrategy;
try {
    NaverStrategy = require('passport-naver-v2').Strategy;
} catch (e) {
    try {
        NaverStrategy = require('passport-naver').Strategy;
    } catch (e2) {
        console.warn('Naver passport strategy를 불러올 수 없습니다. passport-naver-v2를 설치하세요.');
    }
}

// 사용자 직렬화
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser((id, done) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        done(null, user || false);
    } catch (e) {
        done(e);
    }
});

// 사용자 찾기 또는 생성
function findOrCreateUser(provider, providerId, email, name, profileImage) {
    let user = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, providerId);

    if (user) {
        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP, name = ?, profile_image = ? WHERE id = ?')
          .run(name || user.name, profileImage || user.profile_image, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    } else {
        const result = db.prepare(
            'INSERT INTO users (provider, provider_id, email, name, profile_image) VALUES (?, ?, ?, ?, ?)'
        ).run(provider, String(providerId), email || '', name || '', profileImage || '');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    return user;
}

// Google 전략
if (process.env.GOOGLE_CLIENT_ID) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.BASE_URL
            ? process.env.BASE_URL + '/auth/google/callback'
            : '/auth/google/callback',
        proxy: true
    }, (accessToken, refreshToken, profile, done) => {
        try {
            const user = findOrCreateUser(
                'google',
                profile.id,
                profile.emails?.[0]?.value,
                profile.displayName,
                profile.photos?.[0]?.value
            );
            return done(null, user);
        } catch (e) {
            return done(e);
        }
    }));
}

// Naver 전략
if (NaverStrategy && process.env.NAVER_CLIENT_ID) {
    passport.use(new NaverStrategy({
        clientID: process.env.NAVER_CLIENT_ID,
        clientSecret: process.env.NAVER_CLIENT_SECRET,
        callbackURL: process.env.BASE_URL
            ? process.env.BASE_URL + '/auth/naver/callback'
            : '/auth/naver/callback',
        proxy: true
    }, (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value || profile._json?.email || '';
            const profileImage = profile._json?.profile_image || profile.photos?.[0]?.value || '';
            const user = findOrCreateUser(
                'naver',
                profile.id,
                email,
                profile.displayName || profile._json?.name || '',
                profileImage
            );
            return done(null, user);
        } catch (e) {
            return done(e);
        }
    }));
}

// 라우트
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed' }),
    (req, res) => res.redirect('/')
);

router.get('/naver', (req, res, next) => {
    if (!NaverStrategy || !process.env.NAVER_CLIENT_ID) {
        return res.redirect('/?error=naver_not_configured');
    }
    passport.authenticate('naver')(req, res, next);
});

router.get('/naver/callback',
    passport.authenticate('naver', { failureRedirect: '/?error=auth_failed' }),
    (req, res) => res.redirect('/')
);

router.post('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy((err) => {
            res.clearCookie('gd.sid');
            res.redirect('/');
        });
    });
});

router.get('/me', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id, email, name, profile_image, role } = req.user;
    res.json({ id, email, name, profile_image, role });
});

module.exports = router;
