const express = require('express');
const db = require('../db');

const router = express.Router();

// 인증 미들웨어
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: '로그인이 필요합니다.' });
}

// 관리자 미들웨어
function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') return next();
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
}

// 모임 객체 빌드 헬퍼
function buildMeetingObject(meeting) {
    const members = db.prepare(
        'SELECT member_name FROM meeting_members WHERE meeting_id = ? ORDER BY id'
    ).all(meeting.id).map(r => r.member_name);

    const rawExpenses = db.prepare(
        'SELECT * FROM expenses WHERE meeting_id = ? ORDER BY date, id'
    ).all(meeting.id);

    const expenses = rawExpenses.map(expense => {
        const splits = db.prepare(
            'SELECT member_name FROM expense_splits WHERE expense_id = ?'
        ).all(expense.id).map(r => r.member_name);

        return {
            id: expense.id,
            date: expense.date,
            description: expense.description,
            amount: expense.amount,
            paidBy: expense.payer,
            appliedTo: splits,
            splitAmount: splits.length > 0 ? expense.amount / splits.length : 0,
            memo: expense.memo || ''
        };
    });

    return {
        id: meeting.id,
        name: meeting.name,
        startDate: meeting.start_date,
        endDate: meeting.end_date,
        members,
        expenses
    };
}

// 지출 객체 빌드 헬퍼
function buildExpenseObject(expense) {
    const splits = db.prepare(
        'SELECT member_name FROM expense_splits WHERE expense_id = ?'
    ).all(expense.id).map(r => r.member_name);

    return {
        id: expense.id,
        date: expense.date,
        description: expense.description,
        amount: expense.amount,
        paidBy: expense.payer,
        appliedTo: splits,
        splitAmount: splits.length > 0 ? expense.amount / splits.length : 0,
        memo: expense.memo || ''
    };
}

// ===========================
// 글로벌 회원
// ===========================

router.get('/members', isAuthenticated, (req, res) => {
    const members = db.prepare(
        'SELECT id, name FROM members WHERE user_id = ? ORDER BY name'
    ).all(req.user.id);
    res.json(members);
});

router.post('/members', isAuthenticated, (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '이름을 입력하세요.' });

    try {
        const result = db.prepare(
            'INSERT INTO members (user_id, name) VALUES (?, ?)'
        ).run(req.user.id, name.trim());
        res.json({ id: result.lastInsertRowid, name: name.trim() });
    } catch (e) {
        if (e.message.includes('UNIQUE')) {
            return res.status(409).json({ error: '이미 등록된 회원입니다.' });
        }
        throw e;
    }
});

router.delete('/members/:id', isAuthenticated, (req, res) => {
    db.prepare('DELETE FROM members WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
});

// ===========================
// 모임
// ===========================

router.get('/meetings', isAuthenticated, (req, res) => {
    const meetings = db.prepare(
        'SELECT * FROM meetings WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json(meetings.map(buildMeetingObject));
});

router.post('/meetings', isAuthenticated, (req, res) => {
    const { name, startDate, endDate, members } = req.body;
    if (!name?.trim() || !startDate || !endDate || !Array.isArray(members)) {
        return res.status(400).json({ error: '필수 항목을 입력하세요.' });
    }

    const create = db.transaction(() => {
        const result = db.prepare(
            'INSERT INTO meetings (user_id, name, start_date, end_date) VALUES (?, ?, ?, ?)'
        ).run(req.user.id, name.trim(), startDate, endDate);

        const meetingId = result.lastInsertRowid;
        const insertMember = db.prepare('INSERT INTO meeting_members (meeting_id, member_name) VALUES (?, ?)');
        members.forEach(n => insertMember.run(meetingId, n));

        // 글로벌 회원 목록에도 추가
        const insertGlobal = db.prepare('INSERT OR IGNORE INTO members (user_id, name) VALUES (?, ?)');
        members.forEach(n => insertGlobal.run(req.user.id, n));

        return db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
    });

    const meeting = create();
    res.json(buildMeetingObject(meeting));
});

router.get('/meetings/:id', isAuthenticated, (req, res) => {
    const meeting = db.prepare(
        'SELECT * FROM meetings WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!meeting) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });
    res.json(buildMeetingObject(meeting));
});

router.put('/meetings/:id', isAuthenticated, (req, res) => {
    const { name, startDate, endDate, members } = req.body;
    if (!name?.trim() || !startDate || !endDate || !Array.isArray(members)) {
        return res.status(400).json({ error: '필수 항목을 입력하세요.' });
    }

    const meeting = db.prepare(
        'SELECT id FROM meetings WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!meeting) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });

    const update = db.transaction(() => {
        db.prepare(
            'UPDATE meetings SET name = ?, start_date = ?, end_date = ? WHERE id = ?'
        ).run(name.trim(), startDate, endDate, req.params.id);

        db.prepare('DELETE FROM meeting_members WHERE meeting_id = ?').run(req.params.id);
        const insertMember = db.prepare('INSERT INTO meeting_members (meeting_id, member_name) VALUES (?, ?)');
        members.forEach(n => insertMember.run(req.params.id, n));

        // 글로벌 회원 목록에도 추가
        const insertGlobal = db.prepare('INSERT OR IGNORE INTO members (user_id, name) VALUES (?, ?)');
        members.forEach(n => insertGlobal.run(req.user.id, n));

        return db.prepare('SELECT * FROM meetings WHERE id = ?').get(req.params.id);
    });

    res.json(buildMeetingObject(update()));
});

router.delete('/meetings/:id', isAuthenticated, (req, res) => {
    db.prepare('DELETE FROM meetings WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
});

// ===========================
// 지출
// ===========================

router.get('/meetings/:id/expenses', isAuthenticated, (req, res) => {
    const meeting = db.prepare(
        'SELECT id FROM meetings WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!meeting) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });

    const expenses = db.prepare(
        'SELECT * FROM expenses WHERE meeting_id = ? ORDER BY date, id'
    ).all(req.params.id);
    res.json(expenses.map(buildExpenseObject));
});

router.post('/meetings/:id/expenses', isAuthenticated, (req, res) => {
    const meeting = db.prepare(
        'SELECT id FROM meetings WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!meeting) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });

    const { date, description, amount, paidBy, appliedTo, memo } = req.body;
    if (!date || !description || !amount || !paidBy || !Array.isArray(appliedTo) || appliedTo.length === 0) {
        return res.status(400).json({ error: '필수 항목을 입력하세요.' });
    }

    const create = db.transaction(() => {
        const result = db.prepare(
            'INSERT INTO expenses (meeting_id, date, description, amount, payer, memo) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(req.params.id, date, description, Number(amount), paidBy, memo || '');

        const expenseId = result.lastInsertRowid;
        const insertSplit = db.prepare('INSERT INTO expense_splits (expense_id, member_name) VALUES (?, ?)');
        appliedTo.forEach(n => insertSplit.run(expenseId, n));

        return db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
    });

    res.json(buildExpenseObject(create()));
});

router.put('/meetings/:id/expenses/:eid', isAuthenticated, (req, res) => {
    const meeting = db.prepare(
        'SELECT id FROM meetings WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!meeting) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });

    const { date, description, amount, paidBy, appliedTo, memo } = req.body;
    if (!date || !description || !amount || !paidBy || !Array.isArray(appliedTo) || appliedTo.length === 0) {
        return res.status(400).json({ error: '필수 항목을 입력하세요.' });
    }

    const update = db.transaction(() => {
        db.prepare(
            'UPDATE expenses SET date = ?, description = ?, amount = ?, payer = ?, memo = ? WHERE id = ? AND meeting_id = ?'
        ).run(date, description, Number(amount), paidBy, memo || '', req.params.eid, req.params.id);

        db.prepare('DELETE FROM expense_splits WHERE expense_id = ?').run(req.params.eid);
        const insertSplit = db.prepare('INSERT INTO expense_splits (expense_id, member_name) VALUES (?, ?)');
        appliedTo.forEach(n => insertSplit.run(req.params.eid, n));

        return db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.eid);
    });

    const expense = update();
    if (!expense) return res.status(404).json({ error: '지출을 찾을 수 없습니다.' });
    res.json(buildExpenseObject(expense));
});

router.delete('/meetings/:id/expenses/:eid', isAuthenticated, (req, res) => {
    const meeting = db.prepare(
        'SELECT id FROM meetings WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);
    if (!meeting) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });

    db.prepare('DELETE FROM expenses WHERE id = ? AND meeting_id = ?').run(req.params.eid, req.params.id);
    res.json({ success: true });
});

// ===========================
// 관리자
// ===========================

router.get('/admin/users', isAdmin, (req, res) => {
    const users = db.prepare(
        'SELECT id, provider, email, name, profile_image, role, created_at, last_login FROM users ORDER BY created_at DESC'
    ).all();
    res.json(users);
});

router.delete('/admin/users/:id', isAdmin, (req, res) => {
    if (parseInt(req.params.id) === req.user.id) {
        return res.status(400).json({ error: '자신의 계정은 삭제할 수 없습니다.' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

router.put('/admin/users/:id/role', isAdmin, (req, res) => {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.json({ success: true });
});

module.exports = router;
