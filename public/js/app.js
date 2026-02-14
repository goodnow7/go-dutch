// Go Dutch - API 기반 회비 정산 프로그램

// ============================================
// 유틸리티 함수
// ============================================

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

function formatAmountInput(value) {
    var numericValue = value.replace(/[^\d]/g, '');
    if (numericValue === '') return '';
    return new Intl.NumberFormat('ko-KR').format(parseInt(numericValue, 10));
}

function parseAmount(formattedValue) {
    var numericValue = formattedValue.replace(/[^\d]/g, '');
    return numericValue === '' ? 0 : parseInt(numericValue, 10);
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function setupAmountInput(input) {
    input.addEventListener('input', function() {
        var cursorPos = this.selectionStart;
        var oldLength = this.value.length;
        this.value = formatAmountInput(this.value);
        var newLength = this.value.length;
        var newCursorPos = Math.max(0, Math.min(cursorPos + (newLength - oldLength), newLength));
        this.setSelectionRange(newCursorPos, newCursorPos);
    });
    input.addEventListener('paste', function() {
        var _this = this;
        setTimeout(function() { _this.value = formatAmountInput(_this.value); }, 0);
    });
}

function setupDateInputGroup(group) {
    var yearInput = group.querySelector('.date-year');
    var monthInput = group.querySelector('.date-month');
    var dayInput = group.querySelector('.date-day');
    var targetId = group.dataset.target;
    var hiddenInput = document.getElementById(targetId);

    function onlyNumbers(e) { e.target.value = e.target.value.replace(/\D/g, ''); }

    function syncDate() {
        if (yearInput.value && monthInput.value && dayInput.value) {
            hiddenInput.value = yearInput.value.padStart(4, '0') + '-' +
                monthInput.value.padStart(2, '0') + '-' +
                dayInput.value.padStart(2, '0');
        } else {
            hiddenInput.value = '';
        }
    }

    yearInput.addEventListener('input', function(e) {
        onlyNumbers(e); syncDate();
        if (this.value.length === 4) { monthInput.focus(); monthInput.select(); }
    });
    monthInput.addEventListener('input', function(e) {
        onlyNumbers(e);
        if (this.value.length === 2) {
            var val = parseInt(this.value);
            if (val > 12) this.value = '12';
            if (val < 1 && this.value.length === 2) this.value = '01';
        }
        syncDate();
        if (this.value.length === 2) { dayInput.focus(); dayInput.select(); }
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
        if (e.key === 'Backspace' && this.value === '') yearInput.focus();
    });
    dayInput.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && this.value === '') monthInput.focus();
    });
    yearInput.addEventListener('blur', syncDate);
    monthInput.addEventListener('blur', function() {
        if (this.value.length === 1) this.value = this.value.padStart(2, '0');
        syncDate();
    });
    dayInput.addEventListener('blur', function() {
        if (this.value.length === 1) this.value = this.value.padStart(2, '0');
        syncDate();
    });
}

function setDateInputGroupValue(targetId, dateValue) {
    var group = document.querySelector('.date-input-group[data-target="' + targetId + '"]');
    if (!group || !dateValue) return;
    var parts = dateValue.split('-');
    if (parts.length === 3) {
        group.querySelector('.date-year').value = parts[0];
        group.querySelector('.date-month').value = parts[1];
        group.querySelector('.date-day').value = parts[2];
        document.getElementById(targetId).value = dateValue;
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
// API 헬퍼
// ============================================

async function apiCall(url, options) {
    var opts = Object.assign({
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
    }, options || {});
    var response = await fetch(url, opts);
    if (!response.ok) {
        var err = await response.json().catch(function() { return { error: 'Request failed' }; });
        throw new Error(err.error || 'API 오류가 발생했습니다.');
    }
    return response.json();
}

// ============================================
// 앱 상태
// ============================================

var currentMeetingId = null;
var currentMeeting = null;
var globalMembersList = []; // [{id, name}]

var newMembersForCreate = [];
var newMembersForEdit = [];

// ============================================
// 데이터 로드
// ============================================

async function refreshGlobalMembers() {
    globalMembersList = await apiCall('/api/members');
    return globalMembersList;
}

// ============================================
// 화면 전환
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(function(screen) {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

async function showMeetingList() {
    currentMeetingId = null;
    currentMeeting = null;
    await renderMeetingList();
    showScreen('meeting-list-screen');
}

async function showCreateMeeting() {
    await refreshGlobalMembers();
    resetCreateMeetingForm();
    showScreen('create-meeting-screen');
}

async function showExpenseScreen(meetingId) {
    currentMeetingId = meetingId;
    try {
        var meeting = await apiCall('/api/meetings/' + meetingId);
        currentMeeting = meeting;

        document.getElementById('current-meeting-name').textContent = meeting.name;
        document.getElementById('current-meeting-period').textContent =
            formatDate(meeting.startDate) + ' ~ ' + formatDate(meeting.endDate);

        renderExpenseForm(meeting);
        renderExpenseTable(meeting);
        renderSettlement(meeting);

        showScreen('expense-screen');
    } catch (e) {
        alert('모임을 찾을 수 없습니다.');
        showMeetingList();
    }
}

// ============================================
// 모임 목록 화면
// ============================================

async function renderMeetingList() {
    var container = document.getElementById('meetings-container');
    container.innerHTML = '<p class="empty-message">불러오는 중...</p>';

    try {
        var meetings = await apiCall('/api/meetings');

        if (meetings.length === 0) {
            container.innerHTML = '<p class="empty-message">등록된 모임이 없습니다.</p>';
            return;
        }

        container.innerHTML = meetings.map(function(meeting) {
            var totalAmount = meeting.expenses.reduce(function(sum, exp) { return sum + exp.amount; }, 0);
            return '<div class="meeting-card" onclick="showExpenseScreen(' + meeting.id + ')">' +
                '<h3>' + escapeHtml(meeting.name) + '</h3>' +
                '<p class="period">' + formatDate(meeting.startDate) + ' ~ ' + formatDate(meeting.endDate) + '</p>' +
                '<p class="total">' + formatCurrency(totalAmount) + '</p>' +
                '<p class="members-count">회원 ' + meeting.members.length + '명 · 지출 ' + meeting.expenses.length + '건</p>' +
            '</div>';
        }).join('');
    } catch (e) {
        container.innerHTML = '<p class="empty-message">모임 목록을 불러오지 못했습니다.</p>';
    }
}

// ============================================
// 모임 생성 화면 - 회원 관리
// ============================================

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

    if (globalMembersList.length === 0) {
        container.innerHTML = '<p class="empty-message-small">등록된 회원이 없습니다.</p>';
        return;
    }

    container.innerHTML = globalMembersList.map(function(member) {
        var checked = selectedMembers && selectedMembers.includes(member.name) ? ' checked' : '';
        return '<label><input type="checkbox" value="' + escapeHtml(member.name) + '"' + checked +
               ' onchange="updateSelectedMembersDisplay()"> ' + escapeHtml(member.name) + '</label>';
    }).join('');
}

function renderNewMemberTags(containerId, membersArray) {
    var container = document.getElementById(containerId);
    if (membersArray.length === 0) { container.innerHTML = ''; return; }
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

    var globalNames = globalMembersList.map(function(m) { return m.name; });
    var targetArray = containerId === 'new-members-container' ? newMembersForCreate : newMembersForEdit;

    if (globalNames.includes(name) || targetArray.includes(name)) {
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
    var allSelected = getSelectedMembersFromCheckboxes('saved-members-container').concat(newMembersForCreate);
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
    var allSelected = getSelectedMembersFromCheckboxes('edit-saved-members-container').concat(newMembersForEdit);
    if (allSelected.length === 0) {
        container.innerHTML = '<p class="empty-message-small">회원을 선택하거나 추가해주세요.</p>';
        return;
    }
    container.innerHTML = allSelected.map(function(member) {
        return '<span class="selected-member-chip">' + escapeHtml(member) + '</span>';
    }).join('');
}

function getSelectedMembers() {
    return getSelectedMembersFromCheckboxes('saved-members-container').concat(newMembersForCreate);
}

function getEditSelectedMembers() {
    return getSelectedMembersFromCheckboxes('edit-saved-members-container').concat(newMembersForEdit);
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

    if (!meeting.expenses || meeting.expenses.length === 0) {
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
                '<button class="btn btn-secondary btn-small" onclick="editExpense(' + expense.id + ')">수정</button>' +
                '<button class="btn btn-danger btn-small" onclick="deleteExpense(' + expense.id + ')">삭제</button>' +
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

    var transfers = calculateTransfers(settlement);
    renderTransfers(transfers);

    document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('total-splits').textContent = formatCurrency(Math.round(totalSplits));

    var statusEl = document.getElementById('verification-status');
    var isMatch = Math.abs(totalExpenses - totalSplits) < 1;
    statusEl.textContent = isMatch ? '✓ 일치' : '✗ 불일치';
    statusEl.className = 'status ' + (isMatch ? 'match' : 'mismatch');
}

function calculateTransfers(settlement) {
    var creditors = [];
    var debtors = [];

    Object.keys(settlement).forEach(function(member) {
        var balance = Math.round(settlement[member].balance);
        if (balance > 0) creditors.push({ name: member, amount: balance });
        else if (balance < 0) debtors.push({ name: member, amount: -balance });
    });

    creditors.sort(function(a, b) { return b.amount - a.amount; });
    debtors.sort(function(a, b) { return b.amount - a.amount; });

    var transfers = [];
    while (debtors.length > 0 && creditors.length > 0) {
        var debtor = debtors[0];
        var creditor = creditors[0];
        var transferAmount = Math.min(debtor.amount, creditor.amount);

        if (transferAmount > 0) {
            transfers.push({ from: debtor.name, to: creditor.name, amount: transferAmount });
        }

        debtor.amount -= transferAmount;
        creditor.amount -= transferAmount;

        if (debtor.amount === 0) debtors.shift();
        if (creditor.amount === 0) creditors.shift();
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

// ============================================
// 지출 CRUD (API)
// ============================================

async function deleteExpense(expenseId) {
    if (!confirm('이 사용 내역을 삭제하시겠습니까?')) return;
    try {
        await apiCall('/api/meetings/' + currentMeetingId + '/expenses/' + expenseId, { method: 'DELETE' });
        currentMeeting = await apiCall('/api/meetings/' + currentMeetingId);
        renderExpenseTable(currentMeeting);
        renderSettlement(currentMeeting);
    } catch (e) {
        alert('삭제 실패: ' + e.message);
    }
}

function editExpense(expenseId) {
    if (!currentMeeting) return;
    var expense = currentMeeting.expenses.find(function(e) { return e.id === expenseId; });
    if (!expense) return;

    document.getElementById('edit-expense-id').value = expense.id;
    setDateInputGroupValue('edit-expense-date', expense.date);
    document.getElementById('edit-expense-description').value = expense.description;
    document.getElementById('edit-expense-amount').value = formatAmountInput(String(expense.amount));
    document.getElementById('edit-expense-memo').value = expense.memo || '';

    var paidBySelect = document.getElementById('edit-expense-paid-by');
    paidBySelect.innerHTML = currentMeeting.members.map(function(member) {
        return '<option value="' + escapeHtml(member) + '"' + (member === expense.paidBy ? ' selected' : '') + '>' + escapeHtml(member) + '</option>';
    }).join('');

    var appliedContainer = document.getElementById('edit-applied-members-container');
    appliedContainer.innerHTML = currentMeeting.members.map(function(member) {
        return '<label><input type="checkbox" value="' + escapeHtml(member) + '"' +
               (expense.appliedTo.includes(member) ? ' checked' : '') + '> ' + escapeHtml(member) + '</label>';
    }).join('');

    document.getElementById('edit-expense-modal').classList.add('active');
}

// ============================================
// 모임 수정 모달
// ============================================

async function openEditMeetingModal() {
    if (!currentMeeting) return;
    await refreshGlobalMembers();

    document.getElementById('edit-meeting-name').value = currentMeeting.name;
    setDateInputGroupValue('edit-start-date', currentMeeting.startDate);
    setDateInputGroupValue('edit-end-date', currentMeeting.endDate);
    document.getElementById('edit-new-member-input').value = '';

    newMembersForEdit = [];

    var globalNames = globalMembersList.map(function(m) { return m.name; });
    var existingInGlobal = [];
    var notInGlobal = [];

    currentMeeting.members.forEach(function(member) {
        if (globalNames.includes(member)) existingInGlobal.push(member);
        else notInGlobal.push(member);
    });

    newMembersForEdit = notInGlobal;

    renderEditSavedMembersCheckboxes(existingInGlobal);
    renderNewMemberTags('edit-new-members-container', newMembersForEdit);
    updateEditSelectedMembersDisplay();

    document.getElementById('edit-meeting-modal').classList.add('active');
}

function renderEditSavedMembersCheckboxes(selectedMembers) {
    var container = document.getElementById('edit-saved-members-container');
    if (globalMembersList.length === 0) {
        container.innerHTML = '<p class="empty-message-small">등록된 회원이 없습니다.</p>';
        return;
    }
    container.innerHTML = globalMembersList.map(function(member) {
        var checked = selectedMembers && selectedMembers.includes(member.name) ? ' checked' : '';
        return '<label><input type="checkbox" value="' + escapeHtml(member.name) + '"' + checked +
               ' onchange="updateEditSelectedMembersDisplay()"> ' + escapeHtml(member.name) + '</label>';
    }).join('');
}

function closeEditMeetingModal() {
    document.getElementById('edit-meeting-modal').classList.remove('active');
}

// ============================================
// 회원 관리 모달
// ============================================

async function openManageMembersModal() {
    await refreshGlobalMembers();
    renderGlobalMembersList();
    document.getElementById('global-new-member-input').value = '';
    document.getElementById('manage-members-modal').classList.add('active');
}

function closeManageMembersModal() {
    document.getElementById('manage-members-modal').classList.remove('active');
}

function renderGlobalMembersList() {
    var container = document.getElementById('global-members-list');
    if (globalMembersList.length === 0) {
        container.innerHTML = '<p class="empty-message-small">등록된 회원이 없습니다.</p>';
        return;
    }
    container.innerHTML = globalMembersList.map(function(member) {
        return '<div class="member-manage-item">' +
            '<span class="member-name">' + escapeHtml(member.name) + '</span>' +
            '<button type="button" class="btn-delete-member" ' +
            'onclick="deleteGlobalMemberById(' + member.id + ', \'' + escapeHtml(member.name).replace(/'/g, "\\'") + '\')">×</button>' +
        '</div>';
    }).join('');
}

async function deleteGlobalMemberById(id, name) {
    if (!confirm('"' + name + '" 회원을 삭제하시겠습니까?\n(기존 모임의 회원 정보는 유지됩니다)')) return;
    try {
        await apiCall('/api/members/' + id, { method: 'DELETE' });
        await refreshGlobalMembers();
        renderGlobalMembersList();
    } catch (e) {
        alert('삭제 실패: ' + e.message);
    }
}

async function addGlobalMemberFromInput() {
    var input = document.getElementById('global-new-member-input');
    var name = input.value.trim();
    if (!name) return;

    var globalNames = globalMembersList.map(function(m) { return m.name; });
    if (globalNames.includes(name)) {
        alert('이미 등록된 회원입니다.');
        input.value = '';
        input.focus();
        return;
    }

    try {
        await apiCall('/api/members', { method: 'POST', body: JSON.stringify({ name: name }) });
        await refreshGlobalMembers();
        renderGlobalMembersList();
        input.value = '';
        input.focus();
    } catch (e) {
        alert('추가 실패: ' + e.message);
    }
}

// ============================================
// 이벤트 핸들러
// ============================================

document.addEventListener('authReady', function() {
    // 인증 완료 후 앱 초기화
    initApp();
});

function initApp() {
    showMeetingList();

    document.querySelectorAll('.date-input-group').forEach(function(group) {
        setupDateInputGroup(group);
    });

    document.querySelectorAll('.amount-input').forEach(function(input) {
        setupAmountInput(input);
    });

    // 달력 버튼
    document.querySelectorAll('.btn-calendar').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var datePicker = this.parentElement.querySelector('.date-picker-hidden');
            if (datePicker) {
                datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
            }
        });
    });

    document.querySelectorAll('.date-picker-hidden').forEach(function(picker) {
        picker.addEventListener('change', function() {
            if (this.value) setDateInputGroupValue(this.dataset.target, this.value);
        });
    });

    // 새 모임 버튼
    document.getElementById('new-meeting-btn').addEventListener('click', showCreateMeeting);

    // 회원 관리 모달
    document.getElementById('manage-members-btn').addEventListener('click', openManageMembersModal);
    document.getElementById('close-manage-members-btn').addEventListener('click', closeManageMembersModal);
    document.getElementById('manage-members-modal').addEventListener('click', function(e) {
        if (e.target === this) closeManageMembersModal();
    });
    document.getElementById('global-add-member-btn').addEventListener('click', addGlobalMemberFromInput);
    document.getElementById('global-new-member-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); addGlobalMemberFromInput(); }
    });

    // 목록 화면 이동
    document.getElementById('back-to-list-btn').addEventListener('click', showMeetingList);
    document.getElementById('back-to-list-btn-2').addEventListener('click', showMeetingList);

    // 새 회원 추가 (모임 생성)
    document.getElementById('add-member-btn').addEventListener('click', function() {
        addNewMemberFromInput('new-member-input', 'new-members-container');
    });
    document.getElementById('new-member-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); addNewMemberFromInput('new-member-input', 'new-members-container'); }
    });

    // 모임 생성 폼
    document.getElementById('create-meeting-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        var name = document.getElementById('meeting-name').value.trim();
        var startDate = document.getElementById('start-date').value;
        var endDate = document.getElementById('end-date').value;
        var members = getSelectedMembers();

        if (members.length === 0) { alert('최소 1명의 회원을 선택하거나 추가해주세요.'); return; }
        if (new Date(startDate) > new Date(endDate)) { alert('종료 날짜는 시작 날짜 이후여야 합니다.'); return; }

        try {
            var meeting = await apiCall('/api/meetings', {
                method: 'POST',
                body: JSON.stringify({ name: name, startDate: startDate, endDate: endDate, members: members })
            });
            showExpenseScreen(meeting.id);
        } catch (err) {
            alert('모임 생성 실패: ' + err.message);
        }
    });

    // 지출 추가 폼
    document.getElementById('expense-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        var date = document.getElementById('expense-date').value;
        var description = document.getElementById('expense-description').value.trim();
        var amount = parseAmount(document.getElementById('expense-amount').value);
        var memo = document.getElementById('expense-memo').value.trim();
        var paidBy = document.getElementById('expense-paid-by').value;
        var appliedTo = Array.from(
            document.querySelectorAll('#applied-members-container input[type="checkbox"]:checked')
        ).map(function(cb) { return cb.value; });

        if (appliedTo.length === 0) { alert('최소 1명의 적용회원을 선택해주세요.'); return; }

        try {
            var expense = await apiCall('/api/meetings/' + currentMeetingId + '/expenses', {
                method: 'POST',
                body: JSON.stringify({ date: date, description: description, amount: amount, paidBy: paidBy, appliedTo: appliedTo, memo: memo })
            });
            currentMeeting = await apiCall('/api/meetings/' + currentMeetingId);
            renderExpenseTable(currentMeeting);
            renderSettlement(currentMeeting);

            document.getElementById('expense-description').value = '';
            document.getElementById('expense-amount').value = '';
            document.getElementById('expense-memo').value = '';
        } catch (err) {
            alert('지출 추가 실패: ' + err.message);
        }
    });

    // 모임 수정 모달
    document.getElementById('edit-meeting-btn').addEventListener('click', openEditMeetingModal);
    document.getElementById('close-modal-btn').addEventListener('click', closeEditMeetingModal);
    document.getElementById('edit-meeting-modal').addEventListener('click', function(e) {
        if (e.target === this) closeEditMeetingModal();
    });

    // 수정 모달 - 새 회원 추가
    document.getElementById('edit-add-member-btn').addEventListener('click', function() {
        addNewMemberFromInput('edit-new-member-input', 'edit-new-members-container');
    });
    document.getElementById('edit-new-member-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); addNewMemberFromInput('edit-new-member-input', 'edit-new-members-container'); }
    });

    // 모임 수정 폼
    document.getElementById('edit-meeting-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        var name = document.getElementById('edit-meeting-name').value.trim();
        var startDate = document.getElementById('edit-start-date').value;
        var endDate = document.getElementById('edit-end-date').value;
        var members = getEditSelectedMembers();

        if (members.length === 0) { alert('최소 1명의 회원을 선택하거나 추가해주세요.'); return; }
        if (new Date(startDate) > new Date(endDate)) { alert('종료 날짜는 시작 날짜 이후여야 합니다.'); return; }

        try {
            currentMeeting = await apiCall('/api/meetings/' + currentMeetingId, {
                method: 'PUT',
                body: JSON.stringify({ name: name, startDate: startDate, endDate: endDate, members: members })
            });

            document.getElementById('current-meeting-name').textContent = currentMeeting.name;
            document.getElementById('current-meeting-period').textContent =
                formatDate(currentMeeting.startDate) + ' ~ ' + formatDate(currentMeeting.endDate);

            renderExpenseForm(currentMeeting);
            renderExpenseTable(currentMeeting);
            renderSettlement(currentMeeting);
            closeEditMeetingModal();
        } catch (err) {
            alert('수정 실패: ' + err.message);
        }
    });

    // 모임 삭제
    document.getElementById('delete-meeting-btn').addEventListener('click', async function() {
        if (!confirm('이 모임을 삭제하시겠습니까? 모든 사용 내역도 함께 삭제됩니다.')) return;
        try {
            await apiCall('/api/meetings/' + currentMeetingId, { method: 'DELETE' });
            closeEditMeetingModal();
            showMeetingList();
        } catch (err) {
            alert('삭제 실패: ' + err.message);
        }
    });

    // 지출 수정 모달
    document.getElementById('close-expense-modal-btn').addEventListener('click', function() {
        document.getElementById('edit-expense-modal').classList.remove('active');
    });
    document.getElementById('edit-expense-modal').addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });

    // 지출 수정 폼
    document.getElementById('edit-expense-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        var expenseId = document.getElementById('edit-expense-id').value;
        var date = document.getElementById('edit-expense-date').value;
        var description = document.getElementById('edit-expense-description').value.trim();
        var amount = parseAmount(document.getElementById('edit-expense-amount').value);
        var memo = document.getElementById('edit-expense-memo').value.trim();
        var paidBy = document.getElementById('edit-expense-paid-by').value;
        var appliedTo = Array.from(
            document.querySelectorAll('#edit-applied-members-container input[type="checkbox"]:checked')
        ).map(function(cb) { return cb.value; });

        if (appliedTo.length === 0) { alert('최소 1명의 적용회원을 선택해주세요.'); return; }

        try {
            await apiCall('/api/meetings/' + currentMeetingId + '/expenses/' + expenseId, {
                method: 'PUT',
                body: JSON.stringify({ date: date, description: description, amount: amount, paidBy: paidBy, appliedTo: appliedTo, memo: memo })
            });
            currentMeeting = await apiCall('/api/meetings/' + currentMeetingId);
            renderExpenseTable(currentMeeting);
            renderSettlement(currentMeeting);
            document.getElementById('edit-expense-modal').classList.remove('active');
        } catch (err) {
            alert('수정 실패: ' + err.message);
        }
    });
}
