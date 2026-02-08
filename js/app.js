// Go Dutch - 회비 정산 프로그램

// ============================================
// 유틸리티 함수
// ============================================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

function formatDate(dateString) {
    var date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// 금액 입력 포맷팅 (천단위 콤마)
function formatAmountInput(value) {
    // 숫자만 추출
    var numericValue = value.replace(/[^\d]/g, '');
    if (numericValue === '') return '';
    // 천단위 콤마 추가
    return new Intl.NumberFormat('ko-KR').format(parseInt(numericValue, 10));
}

// 포맷된 금액에서 숫자만 추출
function parseAmount(formattedValue) {
    var numericValue = formattedValue.replace(/[^\d]/g, '');
    return numericValue === '' ? 0 : parseInt(numericValue, 10);
}

// 금액 입력 필드 설정
function setupAmountInput(input) {
    input.addEventListener('input', function(e) {
        var cursorPos = this.selectionStart;
        var oldLength = this.value.length;
        var oldValue = this.value;

        // 포맷팅 적용
        this.value = formatAmountInput(this.value);

        // 커서 위치 조정
        var newLength = this.value.length;
        var diff = newLength - oldLength;
        var newCursorPos = cursorPos + diff;

        // 커서가 유효한 범위 내에 있도록 조정
        if (newCursorPos < 0) newCursorPos = 0;
        if (newCursorPos > newLength) newCursorPos = newLength;

        this.setSelectionRange(newCursorPos, newCursorPos);
    });

    // 붙여넣기 시에도 포맷팅 적용
    input.addEventListener('paste', function(e) {
        var _this = this;
        setTimeout(function() {
            _this.value = formatAmountInput(_this.value);
        }, 0);
    });
}

// 날짜 입력 그룹 설정
function setupDateInputGroup(group) {
    var yearInput = group.querySelector('.date-year');
    var monthInput = group.querySelector('.date-month');
    var dayInput = group.querySelector('.date-day');
    var targetId = group.dataset.target;
    var hiddenInput = document.getElementById(targetId);

    function onlyNumbers(e) {
        e.target.value = e.target.value.replace(/\D/g, '');
    }

    function syncDate() {
        var year = yearInput.value.padStart(4, '0');
        var month = monthInput.value.padStart(2, '0');
        var day = dayInput.value.padStart(2, '0');

        if (yearInput.value && monthInput.value && dayInput.value) {
            hiddenInput.value = year + '-' + month + '-' + day;
        } else {
            hiddenInput.value = '';
        }
    }

    yearInput.addEventListener('input', function(e) {
        onlyNumbers(e);
        syncDate();
        if (this.value.length === 4) {
            monthInput.focus();
            monthInput.select();
        }
    });

    monthInput.addEventListener('input', function(e) {
        onlyNumbers(e);
        if (this.value.length === 2) {
            var val = parseInt(this.value);
            if (val > 12) this.value = '12';
            if (val < 1 && this.value.length === 2) this.value = '01';
        }
        syncDate();
        if (this.value.length === 2) {
            dayInput.focus();
            dayInput.select();
        }
    });

    dayInput.addEventListener('input', function(e) {
        onlyNumbers(e);
        if (this.value.length === 2) {
            var val = parseInt(this.value);
            if (val > 31) this.value = '31';
            if (val < 1 && this.value.length === 2) this.value = '01';
        }
        syncDate();
    });

    monthInput.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && this.value === '') {
            yearInput.focus();
        }
    });

    dayInput.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && this.value === '') {
            monthInput.focus();
        }
    });

    yearInput.addEventListener('blur', syncDate);
    monthInput.addEventListener('blur', function() {
        if (this.value.length === 1) {
            this.value = this.value.padStart(2, '0');
        }
        syncDate();
    });
    dayInput.addEventListener('blur', function() {
        if (this.value.length === 1) {
            this.value = this.value.padStart(2, '0');
        }
        syncDate();
    });
}

function setDateInputGroupValue(targetId, dateValue) {
    var group = document.querySelector('.date-input-group[data-target="' + targetId + '"]');
    if (!group || !dateValue) return;

    var yearInput = group.querySelector('.date-year');
    var monthInput = group.querySelector('.date-month');
    var dayInput = group.querySelector('.date-day');
    var hiddenInput = document.getElementById(targetId);

    var parts = dateValue.split('-');
    if (parts.length === 3) {
        yearInput.value = parts[0];
        monthInput.value = parts[1];
        dayInput.value = parts[2];
        hiddenInput.value = dateValue;
    }
}

function clearDateInputGroup(targetId) {
    var group = document.querySelector('.date-input-group[data-target="' + targetId + '"]');
    if (!group) return;

    group.querySelector('.date-year').value = '';
    group.querySelector('.date-month').value = '';
    group.querySelector('.date-day').value = '';
    document.getElementById(targetId).value = '';
}

// ============================================
// LocalStorage 관리
// ============================================

var STORAGE_KEY = 'goDutchData';

function getData() {
    var data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        var parsed = JSON.parse(data);
        // 기존 데이터에 globalMembers가 없으면 추가
        if (!parsed.globalMembers) {
            parsed.globalMembers = [];
        }
        return parsed;
    }
    return { meetings: [], globalMembers: [] };
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 전역 회원 관리
function getGlobalMembers() {
    return getData().globalMembers || [];
}

function addGlobalMember(name) {
    var data = getData();
    if (!data.globalMembers.includes(name)) {
        data.globalMembers.push(name);
        data.globalMembers.sort();
        saveData(data);
    }
}

function deleteGlobalMember(name) {
    var data = getData();
    var index = data.globalMembers.indexOf(name);
    if (index > -1) {
        data.globalMembers.splice(index, 1);
        saveData(data);
    }
}

function addGlobalMembers(names) {
    var data = getData();
    names.forEach(function(name) {
        if (!data.globalMembers.includes(name)) {
            data.globalMembers.push(name);
        }
    });
    data.globalMembers.sort();
    saveData(data);
}

function getMeetings() {
    return getData().meetings;
}

function getMeetingById(id) {
    var meetings = getMeetings();
    return meetings.find(function(m) { return m.id === id; });
}

function saveMeeting(meeting) {
    var data = getData();
    var index = data.meetings.findIndex(function(m) { return m.id === meeting.id; });
    if (index >= 0) {
        data.meetings[index] = meeting;
    } else {
        data.meetings.push(meeting);
    }
    // 모임 회원들을 전역 회원 목록에 추가
    meeting.members.forEach(function(name) {
        if (!data.globalMembers.includes(name)) {
            data.globalMembers.push(name);
        }
    });
    data.globalMembers.sort();
    saveData(data);
}

function deleteMeeting(id) {
    var data = getData();
    data.meetings = data.meetings.filter(function(m) { return m.id !== id; });
    saveData(data);
}

// ============================================
// 화면 전환
// ============================================

var currentMeetingId = null;

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(function(screen) {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showMeetingList() {
    currentMeetingId = null;
    renderMeetingList();
    showScreen('meeting-list-screen');
}

function showCreateMeeting() {
    resetCreateMeetingForm();
    showScreen('create-meeting-screen');
}

function showExpenseScreen(meetingId) {
    currentMeetingId = meetingId;
    var meeting = getMeetingById(meetingId);
    if (!meeting) {
        alert('모임을 찾을 수 없습니다.');
        showMeetingList();
        return;
    }

    document.getElementById('current-meeting-name').textContent = meeting.name;
    document.getElementById('current-meeting-period').textContent =
        formatDate(meeting.startDate) + ' ~ ' + formatDate(meeting.endDate);

    renderExpenseForm(meeting);
    renderExpenseTable(meeting);
    renderSettlement(meeting);

    showScreen('expense-screen');
}

// ============================================
// 모임 목록 화면
// ============================================

function renderMeetingList() {
    var container = document.getElementById('meetings-container');
    var meetings = getMeetings();

    if (meetings.length === 0) {
        container.innerHTML = '<p class="empty-message">등록된 모임이 없습니다.</p>';
        return;
    }

    container.innerHTML = meetings.map(function(meeting) {
        var totalAmount = meeting.expenses.reduce(function(sum, exp) { return sum + exp.amount; }, 0);
        return '<div class="meeting-card" onclick="showExpenseScreen(\'' + meeting.id + '\')">' +
                '<h3>' + escapeHtml(meeting.name) + '</h3>' +
                '<p class="period">' + formatDate(meeting.startDate) + ' ~ ' + formatDate(meeting.endDate) + '</p>' +
                '<p class="total">' + formatCurrency(totalAmount) + '</p>' +
                '<p class="members-count">회원 ' + meeting.members.length + '명 · 지출 ' + meeting.expenses.length + '건</p>' +
            '</div>';
    }).join('');
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// 모임 생성 화면 - 회원 관리
// ============================================

// 새로 추가된 회원 임시 저장 (모임 생성/수정 시)
var newMembersForCreate = [];
var newMembersForEdit = [];

function resetCreateMeetingForm() {
    document.getElementById('meeting-name').value = '';
    clearDateInputGroup('start-date');
    clearDateInputGroup('end-date');
    document.getElementById('new-member-input').value = '';

    newMembersForCreate = [];

    renderSavedMembersCheckboxes();
    renderNewMemberTags('new-members-container', newMembersForCreate);
    updateSelectedMembersDisplay();
}

function renderSavedMembersCheckboxes(selectedMembers) {
    var container = document.getElementById('saved-members-container');
    var globalMembers = getGlobalMembers();

    if (globalMembers.length === 0) {
        container.innerHTML = '<p class="empty-message-small">등록된 회원이 없습니다.</p>';
        return;
    }

    container.innerHTML = globalMembers.map(function(member) {
        var checked = selectedMembers && selectedMembers.includes(member) ? ' checked' : '';
        return '<label><input type="checkbox" value="' + escapeHtml(member) + '"' + checked + ' onchange="updateSelectedMembersDisplay()"> ' + escapeHtml(member) + '</label>';
    }).join('');
}

function renderNewMemberTags(containerId, membersArray) {
    var container = document.getElementById(containerId);

    if (membersArray.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = membersArray.map(function(member, index) {
        return '<span class="new-member-tag">' + escapeHtml(member) +
               '<button type="button" class="remove-tag" onclick="removeNewMember(\'' + containerId + '\', ' + index + ')">×</button></span>';
    }).join('');
}

function removeNewMember(containerId, index) {
    if (containerId === 'new-members-container') {
        newMembersForCreate.splice(index, 1);
        renderNewMemberTags(containerId, newMembersForCreate);
        updateSelectedMembersDisplay();
    } else {
        newMembersForEdit.splice(index, 1);
        renderNewMemberTags(containerId, newMembersForEdit);
        updateEditSelectedMembersDisplay();
    }
}

function addNewMemberFromInput(inputId, containerId) {
    var input = document.getElementById(inputId);
    var name = input.value.trim();

    if (!name) return;

    var globalMembers = getGlobalMembers();
    var targetArray = containerId === 'new-members-container' ? newMembersForCreate : newMembersForEdit;

    // 이미 존재하는지 확인
    if (globalMembers.includes(name) || targetArray.includes(name)) {
        alert('이미 등록된 회원입니다.');
        input.value = '';
        input.focus();
        return;
    }

    targetArray.push(name);
    renderNewMemberTags(containerId, targetArray);

    if (containerId === 'new-members-container') {
        updateSelectedMembersDisplay();
    } else {
        updateEditSelectedMembersDisplay();
    }

    input.value = '';
    input.focus();
}

function getSelectedMembersFromCheckboxes(containerId) {
    var checkboxes = document.querySelectorAll('#' + containerId + ' input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(function(cb) { return cb.value; });
}

function updateSelectedMembersDisplay() {
    var container = document.getElementById('selected-members-display');
    var selectedFromSaved = getSelectedMembersFromCheckboxes('saved-members-container');
    var allSelected = selectedFromSaved.concat(newMembersForCreate);

    if (allSelected.length === 0) {
        container.innerHTML = '<p class="empty-message-small">회원을 선택하거나 추가해주세요.</p>';
        return;
    }

    container.innerHTML = allSelected.map(function(member) {
        return '<span class="selected-member-chip">' + escapeHtml(member) + '</span>';
    }).join('');
}

function updateEditSelectedMembersDisplay() {
    var container = document.getElementById('edit-selected-members-display');
    var selectedFromSaved = getSelectedMembersFromCheckboxes('edit-saved-members-container');
    var allSelected = selectedFromSaved.concat(newMembersForEdit);

    if (allSelected.length === 0) {
        container.innerHTML = '<p class="empty-message-small">회원을 선택하거나 추가해주세요.</p>';
        return;
    }

    container.innerHTML = allSelected.map(function(member) {
        return '<span class="selected-member-chip">' + escapeHtml(member) + '</span>';
    }).join('');
}

function getSelectedMembers() {
    var selectedFromSaved = getSelectedMembersFromCheckboxes('saved-members-container');
    return selectedFromSaved.concat(newMembersForCreate);
}

function getEditSelectedMembers() {
    var selectedFromSaved = getSelectedMembersFromCheckboxes('edit-saved-members-container');
    return selectedFromSaved.concat(newMembersForEdit);
}

function createMeeting(name, startDate, endDate, members) {
    var meeting = {
        id: generateUUID(),
        name: name,
        startDate: startDate,
        endDate: endDate,
        members: members,
        expenses: []
    };
    saveMeeting(meeting);
    return meeting;
}

// ============================================
// 사용 내역 화면
// ============================================

function renderExpenseForm(meeting) {
    var paidBySelect = document.getElementById('expense-paid-by');
    paidBySelect.innerHTML = '<option value="">선택하세요</option>' +
        meeting.members.map(function(member) {
            return '<option value="' + escapeHtml(member) + '">' + escapeHtml(member) + '</option>';
        }).join('');

    var appliedContainer = document.getElementById('applied-members-container');
    appliedContainer.innerHTML = meeting.members.map(function(member) {
        return '<label><input type="checkbox" value="' + escapeHtml(member) + '" checked> ' + escapeHtml(member) + '</label>';
    }).join('');

    var today = new Date().toISOString().split('T')[0];
    setDateInputGroupValue('expense-date', today);
    document.getElementById('expense-description').value = '';
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-memo').value = '';
}

function renderExpenseTable(meeting) {
    var tbody = document.getElementById('expense-table-body');
    var noExpensesMsg = document.getElementById('no-expenses-message');
    var table = document.getElementById('expense-table');

    if (meeting.expenses.length === 0) {
        table.style.display = 'none';
        noExpensesMsg.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    noExpensesMsg.style.display = 'none';

    var sortedExpenses = meeting.expenses.slice().sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
    });

    tbody.innerHTML = sortedExpenses.map(function(expense) {
        return '<tr>' +
            '<td>' + formatDate(expense.date) + '</td>' +
            '<td>' + escapeHtml(expense.description) + '</td>' +
            '<td class="amount">' + formatCurrency(expense.amount) + '</td>' +
            '<td>' + escapeHtml(expense.paidBy) + '</td>' +
            '<td class="amount">' + formatCurrency(expense.splitAmount) + '</td>' +
            '<td>' + expense.appliedTo.map(function(m) { return escapeHtml(m); }).join(', ') + '</td>' +
            '<td><div class="action-buttons">' +
                '<button class="btn btn-secondary btn-small" onclick="editExpense(\'' + expense.id + '\')">수정</button>' +
                '<button class="btn btn-danger btn-small" onclick="deleteExpense(\'' + expense.id + '\')">삭제</button>' +
            '</div></td>' +
            '<td class="memo" title="' + escapeHtml(expense.memo || '') + '">' + escapeHtml(expense.memo || '') + '</td>' +
        '</tr>';
    }).join('');
}

function renderSettlement(meeting) {
    var settlement = {};
    meeting.members.forEach(function(member) {
        settlement[member] = { paid: 0, owed: 0, balance: 0 };
    });

    var totalExpenses = 0;
    var totalSplits = 0;

    meeting.expenses.forEach(function(expense) {
        totalExpenses += expense.amount;

        if (settlement[expense.paidBy]) {
            settlement[expense.paidBy].paid += expense.amount;
        }

        expense.appliedTo.forEach(function(member) {
            if (settlement[member]) {
                settlement[member].owed += expense.splitAmount;
                totalSplits += expense.splitAmount;
            }
        });
    });

    Object.keys(settlement).forEach(function(member) {
        settlement[member].balance = settlement[member].paid - settlement[member].owed;
    });

    var tbody = document.getElementById('settlement-table-body');
    tbody.innerHTML = meeting.members.map(function(member) {
        var s = settlement[member];
        var balanceClass = s.balance > 0 ? 'positive' : (s.balance < 0 ? 'negative' : '');
        var balanceText = s.balance > 0 ? '+' + formatCurrency(s.balance) + ' (받을 금액)' :
                          s.balance < 0 ? formatCurrency(s.balance) + ' (낼 금액)' :
                          formatCurrency(0);
        return '<tr>' +
            '<td>' + escapeHtml(member) + '</td>' +
            '<td class="amount">' + formatCurrency(s.paid) + '</td>' +
            '<td class="amount">' + formatCurrency(s.owed) + '</td>' +
            '<td class="amount ' + balanceClass + '">' + balanceText + '</td>' +
        '</tr>';
    }).join('');

    // 송금 내역 계산
    var transfers = calculateTransfers(settlement);
    renderTransfers(transfers);

    document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('total-splits').textContent = formatCurrency(Math.round(totalSplits));

    var statusEl = document.getElementById('verification-status');
    var isMatch = Math.abs(totalExpenses - totalSplits) < 1;
    if (isMatch) {
        statusEl.textContent = '✓ 일치';
        statusEl.className = 'status match';
    } else {
        statusEl.textContent = '✗ 불일치';
        statusEl.className = 'status mismatch';
    }
}

function calculateTransfers(settlement) {
    // 채권자(받을 사람)와 채무자(낼 사람) 분리
    var creditors = [];
    var debtors = [];

    Object.keys(settlement).forEach(function(member) {
        var balance = Math.round(settlement[member].balance);
        if (balance > 0) {
            creditors.push({ name: member, amount: balance });
        } else if (balance < 0) {
            debtors.push({ name: member, amount: -balance });
        }
    });

    // 금액 순으로 정렬 (큰 금액 먼저)
    creditors.sort(function(a, b) { return b.amount - a.amount; });
    debtors.sort(function(a, b) { return b.amount - a.amount; });

    var transfers = [];

    // 채무자가 채권자에게 송금
    while (debtors.length > 0 && creditors.length > 0) {
        var debtor = debtors[0];
        var creditor = creditors[0];

        var transferAmount = Math.min(debtor.amount, creditor.amount);

        if (transferAmount > 0) {
            transfers.push({
                from: debtor.name,
                to: creditor.name,
                amount: transferAmount
            });
        }

        debtor.amount -= transferAmount;
        creditor.amount -= transferAmount;

        if (debtor.amount === 0) {
            debtors.shift();
        }
        if (creditor.amount === 0) {
            creditors.shift();
        }
    }

    return transfers;
}

function renderTransfers(transfers) {
    var container = document.getElementById('transfer-list');

    if (transfers.length === 0) {
        container.innerHTML = '<p class="empty-message-small">정산할 내역이 없습니다.</p>';
        return;
    }

    container.innerHTML = transfers.map(function(t) {
        return '<div class="transfer-item">' +
            '<span class="transfer-from">' + escapeHtml(t.from) + '</span>' +
            '<span class="transfer-arrow">→</span>' +
            '<span class="transfer-to">' + escapeHtml(t.to) + '</span>' +
            '<span class="transfer-amount">' + formatCurrency(t.amount) + '</span>' +
        '</div>';
    }).join('');
}

function addExpense(date, description, amount, memo, paidBy, appliedTo) {
    var meeting = getMeetingById(currentMeetingId);
    if (!meeting) return;

    var splitAmount = amount / appliedTo.length;

    var expense = {
        id: generateUUID(),
        date: date,
        description: description,
        amount: amount,
        memo: memo,
        paidBy: paidBy,
        appliedTo: appliedTo,
        splitAmount: splitAmount
    };

    meeting.expenses.push(expense);
    saveMeeting(meeting);

    renderExpenseTable(meeting);
    renderSettlement(meeting);
}

function deleteExpense(expenseId) {
    if (!confirm('이 사용 내역을 삭제하시겠습니까?')) return;

    var meeting = getMeetingById(currentMeetingId);
    if (!meeting) return;

    meeting.expenses = meeting.expenses.filter(function(e) { return e.id !== expenseId; });
    saveMeeting(meeting);

    renderExpenseTable(meeting);
    renderSettlement(meeting);
}

function editExpense(expenseId) {
    var meeting = getMeetingById(currentMeetingId);
    if (!meeting) return;

    var expense = meeting.expenses.find(function(e) { return e.id === expenseId; });
    if (!expense) return;

    document.getElementById('edit-expense-id').value = expense.id;
    setDateInputGroupValue('edit-expense-date', expense.date);
    document.getElementById('edit-expense-description').value = expense.description;
    document.getElementById('edit-expense-amount').value = formatAmountInput(String(expense.amount));
    document.getElementById('edit-expense-memo').value = expense.memo || '';

    var paidBySelect = document.getElementById('edit-expense-paid-by');
    paidBySelect.innerHTML = meeting.members.map(function(member) {
        return '<option value="' + escapeHtml(member) + '"' + (member === expense.paidBy ? ' selected' : '') + '>' + escapeHtml(member) + '</option>';
    }).join('');

    var appliedContainer = document.getElementById('edit-applied-members-container');
    appliedContainer.innerHTML = meeting.members.map(function(member) {
        return '<label><input type="checkbox" value="' + escapeHtml(member) + '"' + (expense.appliedTo.includes(member) ? ' checked' : '') + '> ' + escapeHtml(member) + '</label>';
    }).join('');

    document.getElementById('edit-expense-modal').classList.add('active');
}

function updateExpense(expenseId, date, description, amount, memo, paidBy, appliedTo) {
    var meeting = getMeetingById(currentMeetingId);
    if (!meeting) return;

    var expenseIndex = meeting.expenses.findIndex(function(e) { return e.id === expenseId; });
    if (expenseIndex < 0) return;

    var splitAmount = amount / appliedTo.length;

    meeting.expenses[expenseIndex] = {
        id: expenseId,
        date: date,
        description: description,
        amount: amount,
        memo: memo,
        paidBy: paidBy,
        appliedTo: appliedTo,
        splitAmount: splitAmount
    };

    saveMeeting(meeting);

    renderExpenseTable(meeting);
    renderSettlement(meeting);
}

// ============================================
// 모임 수정 모달
// ============================================

function openEditMeetingModal() {
    var meeting = getMeetingById(currentMeetingId);
    if (!meeting) return;

    document.getElementById('edit-meeting-name').value = meeting.name;
    setDateInputGroupValue('edit-start-date', meeting.startDate);
    setDateInputGroupValue('edit-end-date', meeting.endDate);
    document.getElementById('edit-new-member-input').value = '';

    newMembersForEdit = [];

    // 기존 모임 회원 중 전역에 없는 회원은 새 회원으로 처리
    var globalMembers = getGlobalMembers();
    var existingInGlobal = [];
    var notInGlobal = [];

    meeting.members.forEach(function(member) {
        if (globalMembers.includes(member)) {
            existingInGlobal.push(member);
        } else {
            notInGlobal.push(member);
        }
    });

    newMembersForEdit = notInGlobal;

    // 전역 회원 체크박스 렌더링 (기존 모임 회원 선택됨)
    renderEditSavedMembersCheckboxes(existingInGlobal);
    renderNewMemberTags('edit-new-members-container', newMembersForEdit);
    updateEditSelectedMembersDisplay();

    document.getElementById('edit-meeting-modal').classList.add('active');
}

function renderEditSavedMembersCheckboxes(selectedMembers) {
    var container = document.getElementById('edit-saved-members-container');
    var globalMembers = getGlobalMembers();

    if (globalMembers.length === 0) {
        container.innerHTML = '<p class="empty-message-small">등록된 회원이 없습니다.</p>';
        return;
    }

    container.innerHTML = globalMembers.map(function(member) {
        var checked = selectedMembers && selectedMembers.includes(member) ? ' checked' : '';
        return '<label><input type="checkbox" value="' + escapeHtml(member) + '"' + checked + ' onchange="updateEditSelectedMembersDisplay()"> ' + escapeHtml(member) + '</label>';
    }).join('');
}

function closeEditMeetingModal() {
    document.getElementById('edit-meeting-modal').classList.remove('active');
}

function updateMeeting(name, startDate, endDate, members) {
    var meeting = getMeetingById(currentMeetingId);
    if (!meeting) return;

    meeting.name = name;
    meeting.startDate = startDate;
    meeting.endDate = endDate;
    meeting.members = members;

    saveMeeting(meeting);

    document.getElementById('current-meeting-name').textContent = meeting.name;
    document.getElementById('current-meeting-period').textContent =
        formatDate(meeting.startDate) + ' ~ ' + formatDate(meeting.endDate);

    renderExpenseForm(meeting);
    renderExpenseTable(meeting);
    renderSettlement(meeting);
}

// ============================================
// 회원 관리 모달
// ============================================

function openManageMembersModal() {
    renderGlobalMembersList();
    document.getElementById('global-new-member-input').value = '';
    document.getElementById('manage-members-modal').classList.add('active');
}

function closeManageMembersModal() {
    document.getElementById('manage-members-modal').classList.remove('active');
}

function renderGlobalMembersList() {
    var container = document.getElementById('global-members-list');
    var globalMembers = getGlobalMembers();

    if (globalMembers.length === 0) {
        container.innerHTML = '<p class="empty-message-small">등록된 회원이 없습니다.</p>';
        return;
    }

    container.innerHTML = globalMembers.map(function(member) {
        return '<div class="member-manage-item">' +
            '<span class="member-name">' + escapeHtml(member) + '</span>' +
            '<button type="button" class="btn-delete-member" onclick="deleteGlobalMemberAndRefresh(\'' + escapeHtml(member).replace(/'/g, "\\'") + '\')">×</button>' +
        '</div>';
    }).join('');
}

function deleteGlobalMemberAndRefresh(name) {
    if (!confirm('"' + name + '" 회원을 삭제하시겠습니까?\n(기존 모임의 회원 정보는 유지됩니다)')) {
        return;
    }
    deleteGlobalMember(name);
    renderGlobalMembersList();
}

function addGlobalMemberFromInput() {
    var input = document.getElementById('global-new-member-input');
    var name = input.value.trim();

    if (!name) return;

    var globalMembers = getGlobalMembers();
    if (globalMembers.includes(name)) {
        alert('이미 등록된 회원입니다.');
        input.value = '';
        input.focus();
        return;
    }

    addGlobalMember(name);
    renderGlobalMembersList();
    input.value = '';
    input.focus();
}

// ============================================
// 이벤트 핸들러
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    showMeetingList();

    document.querySelectorAll('.date-input-group').forEach(function(group) {
        setupDateInputGroup(group);
    });

    // 금액 입력 필드 설정
    document.querySelectorAll('.amount-input').forEach(function(input) {
        setupAmountInput(input);
    });

    // 달력 버튼 클릭 시 날짜 선택기 열기
    document.querySelectorAll('.btn-calendar').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var targetId = this.dataset.target;
            var datePicker = this.parentElement.querySelector('.date-picker-hidden');
            if (datePicker) {
                datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
            }
        });
    });

    // 날짜 선택기에서 날짜 선택 시 입력 필드에 반영
    document.querySelectorAll('.date-picker-hidden').forEach(function(picker) {
        picker.addEventListener('change', function() {
            var targetId = this.dataset.target;
            if (this.value) {
                setDateInputGroupValue(targetId, this.value);
            }
        });
    });

    document.getElementById('new-meeting-btn').addEventListener('click', showCreateMeeting);

    // 회원 관리 모달
    document.getElementById('manage-members-btn').addEventListener('click', openManageMembersModal);

    document.getElementById('close-manage-members-btn').addEventListener('click', closeManageMembersModal);

    document.getElementById('manage-members-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeManageMembersModal();
        }
    });

    document.getElementById('global-add-member-btn').addEventListener('click', addGlobalMemberFromInput);

    document.getElementById('global-new-member-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addGlobalMemberFromInput();
        }
    });

    document.getElementById('back-to-list-btn').addEventListener('click', showMeetingList);
    document.getElementById('back-to-list-btn-2').addEventListener('click', showMeetingList);

    // 새 회원 추가 버튼
    document.getElementById('add-member-btn').addEventListener('click', function() {
        addNewMemberFromInput('new-member-input', 'new-members-container');
    });

    // 새 회원 입력 필드 엔터 키
    document.getElementById('new-member-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addNewMemberFromInput('new-member-input', 'new-members-container');
        }
    });

    document.getElementById('create-meeting-form').addEventListener('submit', function(e) {
        e.preventDefault();

        var name = document.getElementById('meeting-name').value.trim();
        var startDate = document.getElementById('start-date').value;
        var endDate = document.getElementById('end-date').value;
        var members = getSelectedMembers();

        if (members.length === 0) {
            alert('최소 1명의 회원을 선택하거나 추가해주세요.');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            alert('종료 날짜는 시작 날짜 이후여야 합니다.');
            return;
        }

        var meeting = createMeeting(name, startDate, endDate, members);
        showExpenseScreen(meeting.id);
    });

    document.getElementById('expense-form').addEventListener('submit', function(e) {
        e.preventDefault();

        var date = document.getElementById('expense-date').value;
        var description = document.getElementById('expense-description').value.trim();
        var amount = parseAmount(document.getElementById('expense-amount').value);
        var memo = document.getElementById('expense-memo').value.trim();
        var paidBy = document.getElementById('expense-paid-by').value;

        var appliedCheckboxes = document.querySelectorAll('#applied-members-container input[type="checkbox"]:checked');
        var appliedTo = Array.from(appliedCheckboxes).map(function(cb) { return cb.value; });

        if (appliedTo.length === 0) {
            alert('최소 1명의 적용회원을 선택해주세요.');
            return;
        }

        addExpense(date, description, amount, memo, paidBy, appliedTo);

        document.getElementById('expense-description').value = '';
        document.getElementById('expense-amount').value = '';
        document.getElementById('expense-memo').value = '';
    });

    document.getElementById('edit-meeting-btn').addEventListener('click', openEditMeetingModal);

    document.getElementById('close-modal-btn').addEventListener('click', closeEditMeetingModal);

    document.getElementById('edit-meeting-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditMeetingModal();
        }
    });

    // 수정 모달 - 새 회원 추가 버튼
    document.getElementById('edit-add-member-btn').addEventListener('click', function() {
        addNewMemberFromInput('edit-new-member-input', 'edit-new-members-container');
    });

    // 수정 모달 - 새 회원 입력 필드 엔터 키
    document.getElementById('edit-new-member-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addNewMemberFromInput('edit-new-member-input', 'edit-new-members-container');
        }
    });

    document.getElementById('edit-meeting-form').addEventListener('submit', function(e) {
        e.preventDefault();

        var name = document.getElementById('edit-meeting-name').value.trim();
        var startDate = document.getElementById('edit-start-date').value;
        var endDate = document.getElementById('edit-end-date').value;
        var members = getEditSelectedMembers();

        if (members.length === 0) {
            alert('최소 1명의 회원을 선택하거나 추가해주세요.');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            alert('종료 날짜는 시작 날짜 이후여야 합니다.');
            return;
        }

        updateMeeting(name, startDate, endDate, members);
        closeEditMeetingModal();
    });

    document.getElementById('delete-meeting-btn').addEventListener('click', function() {
        if (!confirm('이 모임을 삭제하시겠습니까? 모든 사용 내역도 함께 삭제됩니다.')) return;

        deleteMeeting(currentMeetingId);
        closeEditMeetingModal();
        showMeetingList();
    });

    document.getElementById('close-expense-modal-btn').addEventListener('click', function() {
        document.getElementById('edit-expense-modal').classList.remove('active');
    });

    document.getElementById('edit-expense-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });

    document.getElementById('edit-expense-form').addEventListener('submit', function(e) {
        e.preventDefault();

        var expenseId = document.getElementById('edit-expense-id').value;
        var date = document.getElementById('edit-expense-date').value;
        var description = document.getElementById('edit-expense-description').value.trim();
        var amount = parseAmount(document.getElementById('edit-expense-amount').value);
        var memo = document.getElementById('edit-expense-memo').value.trim();
        var paidBy = document.getElementById('edit-expense-paid-by').value;

        var appliedCheckboxes = document.querySelectorAll('#edit-applied-members-container input[type="checkbox"]:checked');
        var appliedTo = Array.from(appliedCheckboxes).map(function(cb) { return cb.value; });

        if (appliedTo.length === 0) {
            alert('최소 1명의 적용회원을 선택해주세요.');
            return;
        }

        updateExpense(expenseId, date, description, amount, memo, paidBy, appliedTo);
        document.getElementById('edit-expense-modal').classList.remove('active');
    });
});
