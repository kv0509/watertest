// 玮恩喝水打卡系统 app.js
// 本地存储饮水数据，支持成就、提醒、图表统计

const DEFAULT_DAILY_GOAL = 1500; // 默认每日目标1500ml
const DEFAULT_REMINDER_INTERVAL = 60; // 默认提醒间隔（分钟）

// 初始化数据存储
let waterData = JSON.parse(localStorage.getItem('waterData') || '{}');
let settings = JSON.parse(localStorage.getItem('waterSettings') || '{}');

// 初始化用户数据结构
if (!waterData.history) {
    // 创建初始数据结构
    waterData = {
        history: {},
        streak: 0,
        bestDay: null,
        achievements: []
    };
    
    // 保存数据
    localStorage.setItem('waterData', JSON.stringify(waterData));
}

// 初始化设置
if (!settings.dailyGoal) {
    settings = {
        name: '玮恩',
        dailyGoal: DEFAULT_DAILY_GOAL,
        reminder: true,
        reminderInterval: DEFAULT_REMINDER_INTERVAL,
        theme: 'default'
    };
    
    // 保存设置
    localStorage.setItem('waterSettings', JSON.stringify(settings));
}

const today = luxon.DateTime.local().toFormat('yyyy-MM-dd');
const currentHour = luxon.DateTime.local().toFormat('HH');

// ----------------- DOM 元素 -----------------
// 水瓶和统计
let waterLevelEl;
let currentAmountEl;
let goalPercentEl;
let streakDaysEl;

// 图表
let hourChartEl;
let weeklyChartEl;
let hourChart;
let weeklyChart;

// 成就
let achievementsContainerEl;

// 模态框
let settingsModalEl;
let customAmountModalEl;
let achievementModalEl;

// 提醒
let reminderToastEl;

// ----------------- 初始化 -----------------
function init() {
    console.log('初始化应用...');
    
    // 初始化DOM元素
    initDomElements();
    
    // 应用主题
    applyTheme(settings.theme);
    
    // 更新UI
    updateUI();
    
    // 渲染图表
    renderHourChart();
    renderWeeklyChart();
    
    // 显示成就
    renderAchievements();
    
    // 显示每日提示
    showDailyTip();
    
    // 绑定事件
    bindEvents();
    
    // 设置提醒
    if (settings.reminder) {
        setupReminders();
    }
    
    console.log('应用初始化完成');
}

// 初始化DOM元素
function initDomElements() {
    // 水瓶和统计
    waterLevelEl = document.getElementById('water-level');
    currentAmountEl = document.getElementById('current-amount');
    goalPercentEl = document.getElementById('goal-percent');
    streakDaysEl = document.getElementById('streak-days');
    
    // 图表
    hourChartEl = document.getElementById('hourChart');
    weeklyChartEl = document.getElementById('weeklyChart');
    
    // 成就
    achievementsContainerEl = document.getElementById('achievements-container');
    
    // 模态框
    settingsModalEl = document.getElementById('settings-modal');
    customAmountModalEl = document.getElementById('custom-amount-modal');
    achievementModalEl = document.getElementById('achievement-modal');
    
    // 提醒
    reminderToastEl = document.getElementById('reminder-toast');
    
    console.log('DOM元素初始化完成');
}

// 绑定所有事件
function bindEvents() {
    // 设置按钮
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            openSettingsModal();
        });
    }
    
    // 清除数据按钮
    const clearDataBtn = document.getElementById('clear-data-btn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            if (confirm('确定要清除所有喝水记录吗？这个操作无法撤销。')) {
                clearAllData();
            }
        });
    }
    
    // 关闭按钮
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });
    
    // 保存设置按钮
    const saveSettingsBtn = document.getElementById('save-settings');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    // 自定义喝水量按钮
    const addCustomAmountBtn = document.getElementById('add-custom-amount');
    if (addCustomAmountBtn) {
        addCustomAmountBtn.addEventListener('click', () => {
            const amount = parseInt(document.getElementById('custom-amount').value);
            if (amount && amount > 0) {
                addWater(amount);
                closeAllModals();
            }
        });
    }
    
    // 绑定所有喝水量按钮
    // 注意: 我们已经在HTML中使用onclick属性绑定了addWater函数
    // 所以这里不需要再次绑定点击事件
    // 只需要为自定义按钮绑定事件
    const customButton = document.querySelector('.drink-btn:last-child');
    if (customButton && customButton.textContent.includes('自定义')) {
        // 移除现有的onclick属性以避免重复调用
        customButton.removeAttribute('onclick');
        customButton.addEventListener('click', (e) => {
            showCustomAmountModal();
        });
    }
    
    // 提醒关闭按钮
    const toastCloseBtn = document.querySelector('.toast-close');
    if (toastCloseBtn) {
        toastCloseBtn.addEventListener('click', () => {
            hideToast();
        });
    }
    
    console.log('事件绑定完成');
}

// ----------------- 饮水数据处理 -----------------
// 获取今日总饮水量
function getTodayTotal() {
    if (!waterData.history[today]) {
        return 0;
    }
    
    let total = 0;
    const todayData = waterData.history[today];
    
    Object.keys(todayData).forEach(hour => {
        todayData[hour].forEach(amount => {
            total += amount;
        });
    });
    
    return total;
}

// 获取指定小时的饮水量
function getHourTotal(hour) {
    if (!waterData.history[today] || !waterData.history[today][hour]) {
        return 0;
    }
    
    return waterData.history[today][hour].reduce((sum, amount) => sum + amount, 0);
}

// 添加水滴记录
function addWater(amount) {
    console.log(`添加饮水记录: ${amount}ml`);
    
    // 确保amount是数字类型
    amount = parseInt(amount);
    if (isNaN(amount) || amount <= 0) {
        console.error('无效的饮水量');
        return;
    }
    
    // 确保数据结构存在
    if (!waterData.history[today]) {
        waterData.history[today] = {};
    }
    
    if (!waterData.history[today][currentHour]) {
        waterData.history[today][currentHour] = [];
    }
    
    // 添加记录
    waterData.history[today][currentHour].push(amount);
    
    // 更新连续打卡天数
    updateStreak();
    
    // 检查成就
    checkAchievements();
    
    // 保存数据
    localStorage.setItem('waterData', JSON.stringify(waterData));
    
    // 更新UI
    updateUI();
    
    // 更新图表
    renderHourChart();
    renderWeeklyChart();
    
    // 显示动画效果
    showDrinkAnimation();
}

// 更新连续打卡天数
function updateStreak() {
    const yesterday = luxon.DateTime.local().minus({days: 1}).toFormat('yyyy-MM-dd');
    const todayDate = luxon.DateTime.local().toFormat('yyyy-MM-dd');
    
    // 如果今天还没有记录，则创建记录
    if (!waterData.history[todayDate]) {
        waterData.history[todayDate] = {};
    }
    
    // 检查是否是第一次打卡
    if (!waterData.streak || waterData.streak === 0) {
        waterData.streak = 1;
        console.log('第一次打卡，连续天数设置为1');
    } 
    // 如果已经有连续打卡记录，检查是否需要更新
    else {
        // 如果今天是第一次打卡，并且昨天有记录
        if (Object.keys(waterData.history[todayDate]).length === 0 && waterData.history[yesterday]) {
            // 检查昨天的记录是否有效（至少有一条记录）
            let yesterdayHasRecords = false;
            for (const hour in waterData.history[yesterday]) {
                if (waterData.history[yesterday][hour].length > 0) {
                    yesterdayHasRecords = true;
                    break;
                }
            }
            
            if (yesterdayHasRecords) {
                // 如果昨天有有效记录，增加连续天数
                waterData.streak += 1;
                console.log(`昨天有记录，今天第一次打卡，连续天数增加到${waterData.streak}`);
            } else {
                // 如果昨天没有有效记录，重置连续天数
                waterData.streak = 1;
                console.log('昨天没有有效记录，重置连续天数为1');
            }
        }
        // 如果不是今天第一次打卡，保持连续天数不变
    }
    
    // 更新最佳天数
    if (!waterData.bestDay || getTodayTotal() > waterData.bestDay.amount) {
        waterData.bestDay = {
            date: today,
            amount: getTodayTotal()
        };
    }
}

// 更新总喝水量统计
function updateTotalStats() {
    // 获取DOM元素
    const totalAmountEl = document.getElementById('total-amount');
    const totalDaysEl = document.getElementById('total-days');
    const avgAmountEl = document.getElementById('avg-amount');
    
    if (!totalAmountEl || !totalDaysEl || !avgAmountEl) return;
    
    // 计算总喝水量
    let totalAmount = 0;
    let activeDays = 0;
    
    // 遍历所有历史记录
    for (const date in waterData.history) {
        let dayTotal = 0;
        const dayData = waterData.history[date];
        
        // 计算每天的喝水量
        for (const hour in dayData) {
            dayData[hour].forEach(amount => {
                dayTotal += amount;
            });
        }
        
        // 如果这一天有喝水记录，算作活跃天数
        if (dayTotal > 0) {
            activeDays++;
            totalAmount += dayTotal;
        }
    }
    
    // 计算平均每日喝水量
    const avgAmount = activeDays > 0 ? Math.round(totalAmount / activeDays) : 0;
    
    // 更新UI
    totalAmountEl.textContent = totalAmount;
    totalDaysEl.textContent = activeDays;
    avgAmountEl.textContent = avgAmount;
}

// ----------------- UI更新 -----------------
// 更新所有UI元素
function updateUI() {
    updateWaterBottle();
    updateStats();
}

// 更新水瓶高度
function updateWaterBottle() {
    if (!waterLevelEl) return;
    
    const total = getTodayTotal();
    
    // 调整水位计算逻辑，限制最高水位到瓶口附近
    // 当达到目标的70%时已经到达瓶颈附近，之后增长缓慢
    let percent;
    const ratio = total / settings.dailyGoal;
    
    if (ratio <= 0.7) {
        // 正常增长区间，0-70%的目标对应水位从0%到65%
        percent = Math.round(ratio * (65/0.7));
    } else {
        // 瓶颈区域，70%-100%的目标对应水位从65%到70%
        percent = 65 + Math.round((ratio - 0.7) * (5/0.3));
    }
    
    // 确保水位不超过70%
    percent = Math.min(70, percent);
    
    waterLevelEl.style.height = percent + '%';
    console.log(`水瓶高度更新: ${percent}%，总量: ${total}ml，目标比例: ${ratio}`);
}

// 更新统计数据
function updateStats() {
    const total = getTodayTotal();
    const percent = Math.min(100, Math.round((total / settings.dailyGoal) * 100));
    
    if (currentAmountEl) {
        currentAmountEl.textContent = total;
    }
    
    if (goalPercentEl) {
        goalPercentEl.textContent = percent + '%';
    }
    
    if (streakDaysEl) {
        streakDaysEl.textContent = waterData.streak || 0;
    }
    
    // 更新总喝水量统计
    updateTotalStats();
}

// ----------------- 图表 -----------------
// 渲染小时图表
function renderHourChart() {
    if (!hourChartEl) return;
    
    // 销毁旧图表
    if (hourChart) {
        hourChart.destroy();
    }
    
    // 准备数据
    const hours = [];
    const amounts = [];
    
    // 获取今日所有小时数据
    for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0');
        hours.push(`${hour}:00`);
        
        if (waterData.history[today] && waterData.history[today][hour]) {
            amounts.push(waterData.history[today][hour].reduce((sum, amount) => sum + amount, 0));
        } else {
            amounts.push(0);
        }
    }
    
    // 创建图表
    hourChart = new Chart(hourChartEl, {
        type: 'bar',
        data: {
            labels: hours,
            datasets: [{
                label: '小时饮水量 (ml)',
                data: amounts,
                backgroundColor: 'rgba(79, 195, 247, 0.6)',
                borderColor: 'rgba(79, 195, 247, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '饮水量 (ml)'
                    }
                }
            }
        }
    });
}

// 渲染周图表
function renderWeeklyChart() {
    if (!weeklyChartEl) return;
    
    // 销毁旧图表
    if (weeklyChart) {
        weeklyChart.destroy();
    }
    
    // 准备数据
    const days = [];
    const amounts = [];
    
    // 获取历史数据
    const dates = [];
    const allDates = Object.keys(waterData.history).sort(); // 按日期排序
    
    // 如果有超过30天的数据，只显示最近30天
    const maxDaysToShow = 30;
    const startIdx = Math.max(0, allDates.length - maxDaysToShow);
    
    // 获取要显示的日期
    for (let i = startIdx; i < allDates.length; i++) {
        dates.push(allDates[i]);
    }
    
    // 如果没有历史数据，显示过去7天
    if (dates.length === 0) {
        for (let i = 6; i >= 0; i--) {
            const date = luxon.DateTime.local().minus({days: i}).toFormat('yyyy-MM-dd');
            dates.push(date);
        }
    }
    
    // 处理每一天的数据
    for (const date of dates) {
        // 格式化日期显示
        const dayObj = luxon.DateTime.fromFormat(date, 'yyyy-MM-dd');
        const dayName = dayObj.toFormat('MM/dd');
        days.push(dayName);
        
        // 计算该天的总饮水量
        let total = 0;
        if (waterData.history[date]) {
            Object.keys(waterData.history[date]).forEach(hour => {
                waterData.history[date][hour].forEach(amount => {
                    total += amount;
                });
            });
        }
        
        amounts.push(total);
    }
    
    // 创建图表
    weeklyChart = new Chart(weeklyChartEl, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: '饮水趋势 (ml)',
                data: amounts,
                backgroundColor: 'rgba(79, 195, 247, 0.2)',
                borderColor: 'rgba(79, 195, 247, 1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '饮水量 (ml)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日期 (MM/DD)'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '历史饮水趋势'
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            const idx = tooltipItems[0].dataIndex;
                            return dates[idx];
                        }
                    }
                }
            }
        }
    });
}

// ----------------- 成就系统 -----------------
const ACHIEVEMENTS = [
    {id: 'first', name: '第一次打卡', desc: '记录你的第一杯水！', icon: 'https://cdn-icons-png.flaticon.com/512/824/824239.png'},
    {id: 'daily_goal', name: '达成目标', desc: '完成每日饮水目标', icon: 'https://cdn-icons-png.flaticon.com/512/3588/3588310.png'},
    {id: 'streak3', name: '连续3天', desc: '连续3天记录饮水', icon: 'https://cdn-icons-png.flaticon.com/512/2553/2553691.png'},
    {id: 'streak7', name: '一周坚持', desc: '连续7天记录饮水', icon: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png'},
    {id: 'streak30', name: '月度达人', desc: '连续30天记录饮水', icon: 'https://cdn-icons-png.flaticon.com/512/2553/2553691.png'},
    {id: 'early_bird', name: '早起喝水', desc: '早上8点前记录饮水', icon: 'https://cdn-icons-png.flaticon.com/512/2972/2972531.png'},
    {id: 'night_owl', name: '夜猫子', desc: '晚上10点后记录饮水', icon: 'https://cdn-icons-png.flaticon.com/512/2972/2972510.png'},
    {id: 'custom', name: '自定义饮水', desc: '使用自定义饮水量打卡', icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081566.png'}
];

// 检查成就
function checkAchievements() {
    // 初始化成就数组
    if (!waterData.achievements) {
        waterData.achievements = [];
    }
    
    const newAchievements = [];
    
    // 第一次打卡
    if (!waterData.achievements.includes('first')) {
        waterData.achievements.push('first');
        newAchievements.push('first');
    }
    
    // 达成每日目标
    if (getTodayTotal() >= settings.dailyGoal && !waterData.achievements.includes('daily_goal')) {
        waterData.achievements.push('daily_goal');
        newAchievements.push('daily_goal');
    }
    
    // 连续打卡
    if (waterData.streak >= 3 && !waterData.achievements.includes('streak3')) {
        waterData.achievements.push('streak3');
        newAchievements.push('streak3');
    }
    
    if (waterData.streak >= 7 && !waterData.achievements.includes('streak7')) {
        waterData.achievements.push('streak7');
        newAchievements.push('streak7');
    }
    
    if (waterData.streak >= 30 && !waterData.achievements.includes('streak30')) {
        waterData.achievements.push('streak30');
        newAchievements.push('streak30');
    }
    
    // 早起喝水
    const hour = parseInt(currentHour);
    if (hour < 8 && !waterData.achievements.includes('early_bird')) {
        waterData.achievements.push('early_bird');
        newAchievements.push('early_bird');
    }
    
    // 夜猫子
    if (hour >= 22 && !waterData.achievements.includes('night_owl')) {
        waterData.achievements.push('night_owl');
        newAchievements.push('night_owl');
    }
    
    // 显示新解锁的成就
    if (newAchievements.length > 0) {
        showAchievementUnlocked(newAchievements[0]);
    }
    
    // 更新成就显示
    renderAchievements();
}

// 渲染成就列表
function renderAchievements() {
    if (!achievementsContainerEl) return;
    
    // 清空容器
    achievementsContainerEl.innerHTML = '';
    
    // 添加所有成就
    ACHIEVEMENTS.forEach(achievement => {
        const isUnlocked = waterData.achievements && waterData.achievements.includes(achievement.id);
        
        const achievementEl = document.createElement('div');
        achievementEl.className = `achievement ${isUnlocked ? '' : 'locked'}`;
        
        achievementEl.innerHTML = `
            <img src="${achievement.icon}" alt="${achievement.name}" class="achievement-icon">
            <div class="achievement-name">${achievement.name}</div>
        `;
        
        // 添加提示
        achievementEl.title = achievement.desc;
        
        // 添加点击事件
        achievementEl.addEventListener('click', () => {
            showAchievementDetails(achievement.id);
        });
        
        achievementsContainerEl.appendChild(achievementEl);
    });
}

// 显示成就解锁提示
function showAchievementUnlocked(achievementId) {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return;
    
    // 设置模态框内容
    const iconEl = document.getElementById('achievement-icon');
    const titleEl = document.getElementById('achievement-title');
    const descEl = document.getElementById('achievement-description');
    
    if (iconEl) iconEl.src = achievement.icon;
    if (titleEl) titleEl.textContent = `新成就解锁：${achievement.name}`;
    if (descEl) descEl.textContent = achievement.desc;
    
    // 显示模态框
    if (achievementModalEl) {
        achievementModalEl.style.display = 'block';
    }
}

// 显示成就详情
function showAchievementDetails(achievementId) {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return;
    
    // 设置模态框内容
    const iconEl = document.getElementById('achievement-icon');
    const titleEl = document.getElementById('achievement-title');
    const descEl = document.getElementById('achievement-description');
    
    if (iconEl) iconEl.src = achievement.icon;
    if (titleEl) titleEl.textContent = achievement.name;
    if (descEl) descEl.textContent = achievement.desc;
    
    // 显示模态框
    if (achievementModalEl) {
        achievementModalEl.style.display = 'block';
    }
}

// ----------------- 设置 -----------------
// 打开设置模态框
function openSettingsModal() {
    // 填充当前设置
    const dailyGoalInput = document.getElementById('daily-goal');
    const reminderToggle = document.getElementById('reminder-toggle');
    const reminderIntervalInput = document.getElementById('reminder-interval');
    const themeSelect = document.getElementById('theme-select');
    
    if (dailyGoalInput) dailyGoalInput.value = settings.dailyGoal;
    if (reminderToggle) reminderToggle.checked = settings.reminder;
    if (reminderIntervalInput) reminderIntervalInput.value = settings.reminderInterval;
    if (themeSelect) themeSelect.value = settings.theme;
    
    // 显示模态框
    if (settingsModalEl) {
        settingsModalEl.style.display = 'block';
    }
}

// 保存设置
function saveSettings() {
    const dailyGoalInput = document.getElementById('daily-goal');
    const reminderToggle = document.getElementById('reminder-toggle');
    const reminderIntervalInput = document.getElementById('reminder-interval');
    const themeSelect = document.getElementById('theme-select');
    
    // 更新设置
    if (dailyGoalInput) settings.dailyGoal = parseInt(dailyGoalInput.value);
    if (reminderToggle) settings.reminder = reminderToggle.checked;
    if (reminderIntervalInput) settings.reminderInterval = parseInt(reminderIntervalInput.value);
    if (themeSelect) settings.theme = themeSelect.value;
    
    // 保存设置
    localStorage.setItem('waterSettings', JSON.stringify(settings));
    
    // 应用主题
    applyTheme(settings.theme);
    
    // 更新提醒
    if (settings.reminder) {
        setupReminders();
    }
    
    // 更新UI
    updateUI();
    
    // 关闭模态框
    closeAllModals();
    
    // 显示提示
    showToast('设置已保存！');
}

// 应用主题
function applyTheme(theme) {
    const root = document.documentElement;
    
    switch (theme) {
        case 'pink':
            root.style.setProperty('--primary-color', '#ff80ab');
            root.style.setProperty('--primary-dark', '#c94f7c');
            root.style.setProperty('--primary-light', '#ffe1ec');
            break;
        case 'purple':
            root.style.setProperty('--primary-color', '#b388ff');
            root.style.setProperty('--primary-dark', '#805acb');
            root.style.setProperty('--primary-light', '#e9ddff');
            break;
        case 'green':
            root.style.setProperty('--primary-color', '#69f0ae');
            root.style.setProperty('--primary-dark', '#2bbd7e');
            root.style.setProperty('--primary-light', '#e0f7ef');
            break;
        default: // 默认蓝色
            root.style.setProperty('--primary-color', '#4fc3f7');
            root.style.setProperty('--primary-dark', '#0093c4');
            root.style.setProperty('--primary-light', '#e6f7ff');
    }
}

// ----------------- 工具函数 -----------------
// 显示自定义喝水量模态框
function showCustomAmountModal() {
    if (customAmountModalEl) {
        customAmountModalEl.style.display = 'block';
    }
}

// 清除所有数据
function clearAllData() {
    // 初始化空数据
    waterData = {
        history: {},
        streak: 0,
        bestDay: null,
        achievements: []
    };
    
    // 保存到本地存储
    localStorage.setItem('waterData', JSON.stringify(waterData));
    
    // 更新UI
    updateUI();
    renderHourChart();
    renderWeeklyChart();
    renderAchievements();
    
    // 显示提示
    showToast('所有喝水记录已清除！');
    
    console.log('数据已清除');
}

// 关闭所有模态框
function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// 显示提示
function showToast(message) {
    const toastContent = document.querySelector('.toast-content p');
    if (toastContent) {
        toastContent.textContent = message;
    }
    
    if (reminderToastEl) {
        reminderToastEl.classList.add('show');
        
        // 自动隐藏
        setTimeout(() => {
            hideToast();
        }, 3000);
    }
}

// 隐藏提示
function hideToast() {
    if (reminderToastEl) {
        reminderToastEl.classList.remove('show');
    }
}

// 设置提醒
function setupReminders() {
    // 清除现有提醒
    if (window.reminderInterval) {
        clearInterval(window.reminderInterval);
    }
    
    // 设置新提醒
    window.reminderInterval = setInterval(() => {
        const total = getTodayTotal();
        if (total < settings.dailyGoal) {
            showToast(`玮恩，该喝水啦！今天还需要喝${settings.dailyGoal - total}ml水哦～`);
        }
    }, settings.reminderInterval * 60 * 1000);
}

// 显示每日提示
function showDailyTip() {
    const tips = [
        "每天喝足够的水有助于保持皮肤水分，增强新陈代谢，提高身体免疫力！",
        "研究表明，适量饮水可以帮助减轻头痛和疲劳感。",
        "喝水前先喝一小口，让口腔适应，然后再大口喝水更健康。",
        "早上起床后喝一杯水，可以帮助激活身体机能。",
        "运动前后半小时内适量饮水，有助于提高运动效果和恢复。",
        "长时间使用电子设备会导致眼睛干涩，多喝水可以缓解这种情况。",
        "饭前喝水可以增加饱腹感，有助于控制食量。",
        "喝水时最好小口慢饮，避免一次性大量饮水。"
    ];
    
    const tipEl = document.getElementById('daily-tip');
    if (tipEl) {
        // 根据日期选择提示，确保每天提示不同
        const dayOfYear = luxon.DateTime.local().ordinal;
        const tipIndex = dayOfYear % tips.length;
        tipEl.innerHTML = `<p>${tips[tipIndex]}</p>`;
    }
}

// 显示喝水动画
function showDrinkAnimation() {
    // 水波纹动画效果
    const waterLevelEl = document.getElementById('water-level');
    if (waterLevelEl) {
        waterLevelEl.classList.add('animate');
        setTimeout(() => {
            waterLevelEl.classList.remove('animate');
        }, 1000);
    }
}

// 页面加载完成后初始化
window.onload = init;
