(() => {
  "use strict";

  const STORAGE_KEY = "rupeeledger_finance_v1";

  const VALID_TYPES = [
    "income",
    "expense",
    "balance_add",
    "balance_deduct",
    "savings_alloc",
    "savings_withdraw",
  ];

  const VALID_CATEGORIES = [
    "College expenses",
    "Food",
    "Transport",
    "Shopping",
    "Education",
    "Entertainment",
    "Emergency",
    "Savings",
    "Other",
  ];

  const VALID_PAYMENTS = ["Cash", "UPI", "Card", "Bank Transfer"];

  const CATEGORY_COLORS = {
    "College expenses": "#6366f1",
    Food: "#f59e0b",
    Transport: "#06b6d4",
    Shopping: "#ec4899",
    Education: "#8b5cf6",
    Entertainment: "#14b8a6",
    Emergency: "#ef4444",
    Savings: "#3b82f6",
    Other: "#94a3b8",
  };

  // --- Utility & Formatting Helpers ---

  function getCurrentMonthStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function getTodayDateStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatINR(amount) {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  function formatMonthLabel(monthStr) {
    if (!/^\d{4}-\d{2}$/.test(monthStr)) return monthStr;
    const [year, month] = monthStr.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }

  function generateUniqueId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `tx_${window.crypto.randomUUID()}`;
    }
    return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function roundMoney(val) {
    return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
  }

  // --- State Management & Persistence ---

  let appState = {
    activeMonth: getCurrentMonthStr(),
    budgets: {}, // { "YYYY-MM": { startingBudget, securityAllocation, description } }
    transactions: [], // Array of transaction objects
  };

  let pendingConfirmCallback = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        ensureBudgetExists(appState.activeMonth);
        saveState();
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        appState.activeMonth = /^\d{4}-\d{2}$/.test(parsed.activeMonth)
          ? parsed.activeMonth
          : getCurrentMonthStr();
        appState.budgets =
          parsed.budgets && typeof parsed.budgets === "object" ? parsed.budgets : {};
        appState.transactions = Array.isArray(parsed.transactions)
          ? parsed.transactions.filter(isValidTransactionRecord)
          : [];
      }
      ensureBudgetExists(appState.activeMonth);
    } catch (err) {
      console.error("Failed to parse saved state:", err);
      ensureBudgetExists(appState.activeMonth);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (err) {
      showAlert("Unable to save to LocalStorage. Storage quota may be full.", "error");
    }
  }

  function ensureBudgetExists(monthStr) {
    if (!appState.budgets[monthStr]) {
      appState.budgets[monthStr] = {
        startingBudget: 0,
        securityAllocation: 0,
        description: "",
      };
    }
  }

  function isValidTransactionRecord(tx) {
    return (
      tx &&
      typeof tx.id === "string" &&
      typeof tx.name === "string" &&
      tx.name.trim().length > 0 &&
      typeof tx.amount === "number" &&
      tx.amount > 0 &&
      VALID_TYPES.includes(tx.type) &&
      VALID_CATEGORIES.includes(tx.category) &&
      VALID_PAYMENTS.includes(tx.paymentMethod) &&
      /^\d{4}-\d{2}-\d{2}$/.test(tx.date)
    );
  }

  // --- Core Financial Calculation Engine ---

  function calculateMonthlyMetrics(monthStr) {
    ensureBudgetExists(monthStr);
    const budgetCfg = appState.budgets[monthStr];
    const startingBudget = roundMoney(budgetCfg.startingBudget || 0);
    const initialSecurity = roundMoney(budgetCfg.securityAllocation || 0);

    const monthTxs = appState.transactions.filter((tx) => tx.date.startsWith(monthStr));

    let totalIncome = 0;
    let totalExpenses = 0;
    let balanceAdditions = 0;
    let balanceDeductions = 0;
    let savingsAllocations = 0;
    let savingsWithdrawals = 0;

    for (const tx of monthTxs) {
      const amt = roundMoney(tx.amount);
      switch (tx.type) {
        case "income":
          totalIncome = roundMoney(totalIncome + amt);
          break;
        case "expense":
          totalExpenses = roundMoney(totalExpenses + amt);
          break;
        case "balance_add":
          balanceAdditions = roundMoney(balanceAdditions + amt);
          break;
        case "balance_deduct":
          balanceDeductions = roundMoney(balanceDeductions + amt);
          break;
        case "savings_alloc":
          savingsAllocations = roundMoney(savingsAllocations + amt);
          break;
        case "savings_withdraw":
          savingsWithdrawals = roundMoney(savingsWithdrawals + amt);
          break;
      }
    }

    // Available Balance = Starting Budget + Income + Balance Additions - Expenses - Balance Deductions - Savings Allocations + Savings Withdrawals
    const availableBalance = roundMoney(
      startingBudget +
        totalIncome +
        balanceAdditions -
        totalExpenses -
        balanceDeductions -
        savingsAllocations +
        savingsWithdrawals
    );

    // Current Savings Balance = Initial Security Allocation + Savings Allocations - Savings Withdrawals
    const currentSavingsBalance = roundMoney(
      initialSecurity + savingsAllocations - savingsWithdrawals
    );

    // Total Funds = Available Balance + Current Savings Balance
    const totalFunds = roundMoney(availableBalance + currentSavingsBalance);

    // Remaining Monthly Budget = Monthly Budget - Actual Monthly Expenses
    const remainingBudget = roundMoney(startingBudget - totalExpenses);

    const budgetConsumedPct =
      startingBudget > 0 ? roundMoney((totalExpenses / startingBudget) * 100) : 0;

    const savingsBudgetPct =
      startingBudget > 0 ? roundMoney((currentSavingsBalance / startingBudget) * 100) : 0;

    return {
      monthStr,
      budgetCfg,
      startingBudget,
      initialSecurity,
      totalIncome,
      totalExpenses,
      balanceAdditions,
      balanceDeductions,
      savingsAllocations,
      savingsWithdrawals,
      availableBalance,
      currentSavingsBalance,
      totalFunds,
      remainingBudget,
      budgetConsumedPct,
      savingsBudgetPct,
      netCashFlow: roundMoney(totalIncome - totalExpenses),
      monthTxs,
    };
  }

  // --- UI Notifications & Confirmation Modal ---

  function showAlert(message, type = "success") {
    const container = document.getElementById("alertContainer");
    const div = document.createElement("div");
    div.className = `toast-alert toast-${type}`;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => {
      div.remove();
    }, 3800);
  }

  function openConfirmModal(title, message, onConfirm) {
    document.getElementById("confirmModalTitle").textContent = title;
    document.getElementById("confirmModalMessage").textContent = message;
    pendingConfirmCallback = onConfirm;
    document.getElementById("confirmModal").classList.remove("hidden");
  }

  function closeConfirmModal() {
    pendingConfirmCallback = null;
    document.getElementById("confirmModal").classList.add("hidden");
  }

  // --- Navigation & View Switching ---

  function switchView(viewName) {
    const titles = {
      dashboard: "Financial Dashboard",
      transactions: "Transaction History",
      savings: "Savings & Security Vault",
      budget: "Monthly Budget Setup",
      reports: "Reports & Data Backup",
    };

    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === viewName);
    });

    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === `view-${viewName}`);
    });

    document.getElementById("viewTitle").textContent = titles[viewName] || "Dashboard";
    document.getElementById("sidebar").classList.remove("open");
  }

  // --- Rendering Functions (Safe DOM Construction) ---

  function renderAll() {
    const metrics = calculateMonthlyMetrics(appState.activeMonth);

    const desc = metrics.budgetCfg.description
      ? ` — ${metrics.budgetCfg.description}`
      : "";
    document.getElementById("budgetSubtitle").textContent = `${formatMonthLabel(
      appState.activeMonth
    )}${desc}`;

    renderDashboard(metrics);
    renderTransactionTable();
    renderSavingsSection(metrics);
    renderBudgetForm(metrics);
    renderReportsSection(metrics);
  }

  function renderDashboard(m) {
    document.getElementById("kpiAvailableBalance").textContent = formatINR(m.availableBalance);
    document.getElementById("kpiTotalFunds").textContent = `Total Funds (incl. Savings): ${formatINR(
      m.totalFunds
    )}`;

    document.getElementById("kpiTotalIncome").textContent = formatINR(m.totalIncome);
    document.getElementById("kpiStartingBudget").textContent = `Starting Budget: ${formatINR(
      m.startingBudget
    )}`;

    document.getElementById("kpiTotalExpenses").textContent = formatINR(m.totalExpenses);
    document.getElementById("kpiRemainingBudget").textContent = `Remaining Budget: ${formatINR(
      m.remainingBudget
    )}`;

    document.getElementById("kpiProtectedSavings").textContent = formatINR(
      m.currentSavingsBalance
    );
    document.getElementById("kpiSavingsTarget").textContent = `Initial Security: ${formatINR(
      m.initialSecurity
    )}`;

    const pct = Math.max(0, m.budgetConsumedPct);
    const clampedWidth = Math.min(100, pct);
    const fill = document.getElementById("budgetProgressFill");
    const wrapper = document.getElementById("budgetProgressBarWrapper");

    fill.style.width = `${clampedWidth}%`;
    fill.classList.remove("warn", "danger");
    if (pct >= 100) {
      fill.classList.add("danger");
    } else if (pct >= 80) {
      fill.classList.add("warn");
    }
    wrapper.setAttribute("aria-valuenow", String(Math.round(pct)));
    document.getElementById("budgetPercentLabel").textContent = `${pct.toFixed(1)}% Used`;

    const banner = document.getElementById("overspendBanner");
    if (m.startingBudget > 0 && m.totalExpenses > m.startingBudget) {
      const overBy = formatINR(m.totalExpenses - m.startingBudget);
      banner.textContent = `⚠️ Budget Exceeded: Monthly expenses exceed your ${formatINR(
        m.startingBudget
      )} budget by ${overBy}.`;
      banner.classList.remove("hidden");
    } else if (m.availableBalance < 0) {
      banner.textContent = `⚠️ Negative Available Balance: Your spendable balance is ${formatINR(
        m.availableBalance
      )}.`;
      banner.classList.remove("hidden");
    } else if (m.startingBudget > 0 && pct >= 85) {
      banner.textContent = `⚡ High Budget Usage: You have consumed ${pct.toFixed(
        1
      )}% of your monthly budget.`;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }

    document.getElementById("sumMonthlyBudget").textContent = formatINR(m.startingBudget);
    document.getElementById("sumActualExpenses").textContent = formatINR(m.totalExpenses);
    document.getElementById("sumRemainingBudget").textContent = formatINR(m.remainingBudget);
    document.getElementById("sumNetCashFlow").textContent = formatINR(m.netCashFlow);

    renderCharts(m);
  }

  function renderTransactionTable() {
    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    const catFilter = document.getElementById("filterCategory").value;
    const typeFilter = document.getElementById("filterType").value;
    const monthFilter = document.getElementById("filterMonth").value;
    const sortOrder = document.getElementById("sortOrder").value;

    let filtered = appState.transactions.filter((tx) => {
      if (monthFilter && !tx.date.startsWith(monthFilter)) return false;
      if (catFilter !== "ALL" && tx.category !== catFilter) return false;
      if (typeFilter !== "ALL" && tx.type !== typeFilter) return false;
      if (search) {
        const hay = `${tx.name} ${tx.notes || ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortOrder === "date_desc") return b.date.localeCompare(a.date) || b.timestamp - a.timestamp;
      if (sortOrder === "date_asc") return a.date.localeCompare(b.date) || a.timestamp - b.timestamp;
      if (sortOrder === "amount_desc") return b.amount - a.amount;
      if (sortOrder === "amount_asc") return a.amount - b.amount;
      return 0;
    });

    document.getElementById("txCountBadge").textContent = `${filtered.length} Record${
      filtered.length === 1 ? "" : "s"
    }`;

    const tbody = document.getElementById("transactionTableBody");
    const emptyState = document.getElementById("txEmptyState");
    tbody.replaceChildren();

    if (filtered.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    const typeMeta = {
      income: { label: "Income (+)", cls: "badge-income", sign: "+" },
      expense: { label: "Expense (-)", cls: "badge-expense", sign: "-" },
      balance_add: { label: "Balance Add (+)", cls: "badge-income", sign: "+" },
      balance_deduct: { label: "Balance Deduct (-)", cls: "badge-expense", sign: "-" },
      savings_alloc: { label: "Savings Alloc (→)", cls: "badge-savings", sign: "" },
      savings_withdraw: { label: "Savings Withdraw (←)", cls: "badge-neutral", sign: "" },
    };

    for (const tx of filtered) {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      const strongName = document.createElement("strong");
      strongName.textContent = tx.name;
      tdName.appendChild(strongName);
      if (tx.notes) {
        const noteSpan = document.createElement("span");
        noteSpan.className = "tx-note-sub";
        noteSpan.textContent = tx.notes;
        tdName.appendChild(noteSpan);
      }

      const tdCat = document.createElement("td");
      tdCat.textContent = tx.category;

      const tdType = document.createElement("td");
      const badge = document.createElement("span");
      const info = typeMeta[tx.type] || { label: tx.type, cls: "badge-neutral", sign: "" };
      badge.className = `badge ${info.cls}`;
      badge.textContent = info.label;
      tdType.appendChild(badge);

      const tdPay = document.createElement("td");
      tdPay.textContent = tx.paymentMethod;

      const tdDate = document.createElement("td");
      tdDate.textContent = tx.date;

      const tdAmt = document.createElement("td");
      tdAmt.className = "text-right";
      const amtStrong = document.createElement("strong");
      amtStrong.textContent = `${info.sign}${formatINR(tx.amount)}`;
      if (tx.type === "income" || tx.type === "balance_add") {
        amtStrong.className = "text-income";
      } else if (tx.type === "expense" || tx.type === "balance_deduct") {
        amtStrong.className = "text-expense";
      } else if (tx.type === "savings_alloc") {
        amtStrong.className = "text-savings";
      }
      tdAmt.appendChild(amtStrong);

      const tdActions = document.createElement("td");
      tdActions.className = "text-center";
      const btnWrap = document.createElement("div");
      btnWrap.className = "action-btns";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-secondary btn-sm";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => startEditTransaction(tx.id));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => confirmDeleteTransaction(tx.id));

      btnWrap.append(editBtn, delBtn);
      tdActions.appendChild(btnWrap);

      tr.append(tdName, tdCat, tdType, tdPay, tdDate, tdAmt, tdActions);
      tbody.appendChild(tr);
    }
  }

  function renderSavingsSection(m) {
    document.getElementById("savCurrentBalance").textContent = formatINR(m.currentSavingsBalance);
    document.getElementById("savInitialAlloc").textContent = formatINR(m.initialSecurity);
    document.getElementById("savTotalAllocated").textContent = formatINR(m.savingsAllocations);
    document.getElementById("savTotalWithdrawn").textContent = formatINR(m.savingsWithdrawals);
    document.getElementById(
      "savBudgetPercent"
    ).textContent = `${m.savingsBudgetPct.toFixed(1)}% of Monthly Budget`;

    const savingsTxs = m.monthTxs
      .filter((tx) => tx.type === "savings_alloc" || tx.type === "savings_withdraw")
      .sort((a, b) => b.date.localeCompare(a.date));

    const tbody = document.getElementById("savingsTableBody");
    const emptyState = document.getElementById("savEmptyState");
    tbody.replaceChildren();

    if (savingsTxs.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    for (const tx of savingsTxs) {
      const tr = document.createElement("tr");
      const tdDesc = document.createElement("td");
      tdDesc.textContent = tx.name;

      const tdType = document.createElement("td");
      const badge = document.createElement("span");
      const isAlloc = tx.type === "savings_alloc";
      badge.className = `badge ${isAlloc ? "badge-savings" : "badge-neutral"}`;
      badge.textContent = isAlloc ? "Allocation (+)" : "Withdrawal (-)";
      tdType.appendChild(badge);

      const tdDate = document.createElement("td");
      tdDate.textContent = tx.date;

      const tdAmt = document.createElement("td");
      tdAmt.className = `text-right ${isAlloc ? "text-savings" : "text-expense"}`;
      tdAmt.textContent = `${isAlloc ? "+" : "-"}${formatINR(tx.amount)}`;

      tr.append(tdDesc, tdType, tdDate, tdAmt);
      tbody.appendChild(tr);
    }
  }

  function renderBudgetForm(m) {
    document.getElementById("budgetMonthYear").value = m.monthStr;
    document.getElementById("budgetStartingAmount").value = m.startingBudget || "";
    document.getElementById("budgetSecurityAmount").value = m.initialSecurity || "";
    document.getElementById("budgetDescription").value = m.budgetCfg.description || "";
  }

  function renderReportsSection(m) {
    const container = document.getElementById("reportSummaryContent");
    container.replaceChildren();

    const rows = [
      ["Reporting Period", formatMonthLabel(m.monthStr)],
      ["Monthly Starting Budget", formatINR(m.startingBudget)],
      ["Initial Security Allocation", formatINR(m.initialSecurity)],
      ["Total Income Received (+)", formatINR(m.totalIncome)],
      ["Balance Additions (+)", formatINR(m.balanceAdditions)],
      ["Total Monthly Expenses (-)", formatINR(m.totalExpenses)],
      ["Balance Deductions (-)", formatINR(m.balanceDeductions)],
      ["Savings Allocations (→)", formatINR(m.savingsAllocations)],
      ["Savings Withdrawals (←)", formatINR(m.savingsWithdrawals)],
      ["Current Available Balance", formatINR(m.availableBalance)],
      ["Current Protected Savings", formatINR(m.currentSavingsBalance)],
      ["Total Combined Funds", formatINR(m.totalFunds)],
      ["Remaining Monthly Budget", formatINR(m.remainingBudget)],
    ];

    for (const [label, value] of rows) {
      const div = document.createElement("div");
      div.className = "report-row";
      const span = document.createElement("span");
      span.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      div.append(span, strong);
      container.appendChild(div);
    }
  }

  // --- HTML5 Canvas Data Visualizations ---

  function renderCharts(m) {
    drawCategoryDonutChart(m.monthTxs);
    drawDailyExpenseBarChart(m.monthStr, m.monthTxs);
  }

  function drawCategoryDonutChart(monthTxs) {
    const canvas = document.getElementById("categoryChart");
    const ctx = canvas.getContext("2d");
    const legendEl = document.getElementById("categoryLegend");
    legendEl.replaceChildren();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const totalsByCat = {};
    let totalExp = 0;

    for (const tx of monthTxs) {
      if (tx.type === "expense") {
        totalsByCat[tx.category] = roundMoney((totalsByCat[tx.category] || 0) + tx.amount);
        totalExp = roundMoney(totalExp + tx.amount);
      }
    }

    const entries = Object.entries(totalsByCat).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0 || totalExp <= 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No expenses recorded for this month.", canvas.width / 2, canvas.height / 2);
      return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const outerRadius = 92;
    const innerRadius = 54;
    let startAngle = -Math.PI / 2;

    for (const [cat, amount] of entries) {
      const sliceAngle = (amount / totalExp) * Math.PI * 2;
      const color = CATEGORY_COLORS[cat] || "#6366f1";

      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      startAngle += sliceAngle;

      const item = document.createElement("div");
      item.className = "legend-item";
      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.backgroundColor = color;
      const text = document.createElement("span");
      const pct = ((amount / totalExp) * 100).toFixed(1);
      text.textContent = `${cat}: ${formatINR(amount)} (${pct}%)`;
      item.append(swatch, text);
      legendEl.appendChild(item);
    }

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Expenses", cx, cy - 4);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText(formatINR(totalExp), cx, cy + 14);
  }

  function drawDailyExpenseBarChart(monthStr, monthTxs) {
    const canvas = document.getElementById("dailyChart");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const [year, month] = monthStr.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyTotals = new Array(daysInMonth).fill(0);

    for (const tx of monthTxs) {
      if (tx.type === "expense") {
        const day = Number(tx.date.slice(8, 10));
        if (day >= 1 && day <= daysInMonth) {
          dailyTotals[day - 1] = roundMoney(dailyTotals[day - 1] + tx.amount);
        }
      }
    }

    const maxVal = Math.max(...dailyTotals, 0);
    if (maxVal <= 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No daily expense trend available.", canvas.width / 2, canvas.height / 2);
      return;
    }

    const padLeft = 56;
    const padRight = 16;
    const padTop = 20;
    const padBottom = 32;
    const chartW = canvas.width - padLeft - padRight;
    const chartH = canvas.height - padTop - padBottom;

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";

    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      const val = Math.round(maxVal * (1 - i / 4));
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(canvas.width - padRight, y);
      ctx.stroke();
      ctx.fillText(`₹${val}`, padLeft - 6, y + 4);
    }

    const slotW = chartW / daysInMonth;
    const barW = Math.max(4, slotW * 0.65);

    for (let d = 0; d < daysInMonth; d++) {
      const val = dailyTotals[d];
      const barH = (val / maxVal) * chartH;
      const x = padLeft + d * slotW + (slotW - barW) / 2;
      const y = padTop + chartH - barH;

      ctx.fillStyle = val > 0 ? "#ef4444" : "transparent";
      ctx.fillRect(x, y, barW, barH);

      if ((d + 1) % 5 === 0 || d === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText(String(d + 1), padLeft + d * slotW + slotW / 2, canvas.height - 10);
      }
    }
  }

  // --- CRUD Operations & Validation ---

  function handleTransactionSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById("txEditId").value.trim();
    const name = document.getElementById("txName").value.trim();
    const amount = roundMoney(parseFloat(document.getElementById("txAmount").value));
    const type = document.getElementById("txType").value;
    const category = document.getElementById("txCategory").value;
    const paymentMethod = document.getElementById("txPayment").value;
    const date = document.getElementById("txDate").value;
    const notes = document.getElementById("txNotes").value.trim();

    if (!name) {
      showAlert("Please enter a valid transaction description.", "error");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert("Amount must be a positive number greater than ₹0.", "error");
      return;
    }
    if (!VALID_TYPES.includes(type) || !VALID_CATEGORIES.includes(category) || !VALID_PAYMENTS.includes(paymentMethod)) {
      showAlert("Invalid selection in transaction form.", "error");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      showAlert("Please choose a valid transaction date.", "error");
      return;
    }

    const txMonth = date.slice(0, 7);
    const metrics = calculateMonthlyMetrics(txMonth);

    if (type === "savings_withdraw") {
      let currentSav = metrics.currentSavingsBalance;
      if (editId) {
        const existing = appState.transactions.find((t) => t.id === editId);
        if (existing && existing.type === "savings_withdraw") {
          currentSav = roundMoney(currentSav + existing.amount);
        }
      }
      if (amount > currentSav) {
        showAlert(
          `Insufficient protected savings (${formatINR(currentSav)}) for this withdrawal.`,
          "error"
        );
        return;
      }
    }

    if (editId) {
      const idx = appState.transactions.findIndex((t) => t.id === editId);
      if (idx !== -1) {
        appState.transactions[idx] = {
          ...appState.transactions[idx],
          name,
          amount,
          type,
          category,
          paymentMethod,
          date,
          notes,
        };
        showAlert("Transaction updated and balances recalculated.");
      }
      resetTransactionForm();
    } else {
      const newTx = {
        id: generateUniqueId(),
        timestamp: Date.now(),
        name,
        amount,
        type,
        category,
        paymentMethod,
        date,
        notes,
      };
      appState.transactions.push(newTx);
      showAlert("Transaction saved successfully.");
      document.getElementById("txName").value = "";
      document.getElementById("txAmount").value = "";
      document.getElementById("txNotes").value = "";
    }

    appState.activeMonth = txMonth;
    document.getElementById("activeMonthFilter").value = txMonth;
    document.getElementById("filterMonth").value = txMonth;

    saveState();
    renderAll();
  }

  function startEditTransaction(id) {
    const tx = appState.transactions.find((t) => t.id === id);
    if (!tx) return;

    document.getElementById("txEditId").value = tx.id;
    document.getElementById("txName").value = tx.name;
    document.getElementById("txAmount").value = tx.amount;
    document.getElementById("txType").value = tx.type;
    document.getElementById("txCategory").value = tx.category;
    document.getElementById("txPayment").value = tx.paymentMethod;
    document.getElementById("txDate").value = tx.date;
    document.getElementById("txNotes").value = tx.notes || "";

    document.getElementById("txSubmitBtn").textContent = "Update Transaction";
    document.getElementById("txCancelEditBtn").classList.remove("hidden");

    switchView("dashboard");
    document.getElementById("txName").focus();
  }

  function resetTransactionForm() {
    document.getElementById("txEditId").value = "";
    document.getElementById("txName").value = "";
    document.getElementById("txAmount").value = "";
    document.getElementById("txNotes").value = "";
    document.getElementById("txDate").value = getTodayDateStr();
    document.getElementById("txSubmitBtn").textContent = "Save Transaction";
    document.getElementById("txCancelEditBtn").classList.add("hidden");
  }

  function confirmDeleteTransaction(id) {
    const tx = appState.transactions.find((t) => t.id === id);
    if (!tx) return;

    openConfirmModal(
      "Delete Transaction",
      `Delete "${tx.name}" (${formatINR(tx.amount)})? Balances will recalculate automatically.`,
      () => {
        appState.transactions = appState.transactions.filter((t) => t.id !== id);
        if (document.getElementById("txEditId").value === id) {
          resetTransactionForm();
        }
        saveState();
        renderAll();
        showAlert("Transaction deleted.");
      }
    );
  }

  function handleSavingsTransferSubmit(e) {
    e.preventDefault();
    const actionType = document.getElementById("savActionType").value;
    const amount = roundMoney(parseFloat(document.getElementById("savAmount").value));
    const date = document.getElementById("savDate").value;
    const reason = document.getElementById("savReason").value.trim();

    if (!reason) {
      showAlert("Please enter a transfer description.", "error");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert("Transfer amount must be greater than ₹0.", "error");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      showAlert("Please select a valid transfer date.", "error");
      return;
    }

    const txMonth = date.slice(0, 7);
    const metrics = calculateMonthlyMetrics(txMonth);

    if (actionType === "savings_withdraw" && amount > metrics.currentSavingsBalance) {
      showAlert(
        `Cannot withdraw ${formatINR(amount)}. Protected savings balance is ${formatINR(
          metrics.currentSavingsBalance
        )}.`,
        "error"
      );
      return;
    }

    appState.transactions.push({
      id: generateUniqueId(),
      timestamp: Date.now(),
      name: reason,
      amount,
      type: actionType,
      category: "Savings",
      paymentMethod: "Bank Transfer",
      date,
      notes: "Savings vault transfer",
    });

    document.getElementById("savAmount").value = "";
    document.getElementById("savReason").value = "";
    appState.activeMonth = txMonth;
    document.getElementById("activeMonthFilter").value = txMonth;

    saveState();
    renderAll();
    showAlert("Savings transfer completed.");
  }

  function handleBudgetSetupSubmit(e) {
    e.preventDefault();
    const monthStr = document.getElementById("budgetMonthYear").value;
    const startingBudget = roundMoney(
      parseFloat(document.getElementById("budgetStartingAmount").value)
    );
    const securityAllocation = roundMoney(
      parseFloat(document.getElementById("budgetSecurityAmount").value) || 0
    );
    const description = document.getElementById("budgetDescription").value.trim();

    if (!/^\d{4}-\d{2}$/.test(monthStr)) {
      showAlert("Please select a valid budget month and year.", "error");
      return;
    }
    if (!Number.isFinite(startingBudget) || startingBudget < 0) {
      showAlert("Starting budget cannot be negative.", "error");
      return;
    }
    if (!Number.isFinite(securityAllocation) || securityAllocation < 0) {
      showAlert("Security allocation cannot be negative.", "error");
      return;
    }

    appState.budgets[monthStr] = {
      startingBudget,
      securityAllocation,
      description,
    };

    appState.activeMonth = monthStr;
    document.getElementById("activeMonthFilter").value = monthStr;
    document.getElementById("filterMonth").value = monthStr;

    saveState();
    renderAll();
    showAlert(`Budget updated for ${formatMonthLabel(monthStr)}.`);
  }

  // --- CSV Export, JSON Backup/Restore & Clear Data ---

  function exportCsv() {
    const metrics = calculateMonthlyMetrics(appState.activeMonth);
    if (metrics.monthTxs.length === 0) {
      showAlert("No transactions in the active month to export.", "error");
      return;
    }

    const headers = [
      "ID",
      "Date",
      "Name",
      "Category",
      "Type",
      "Payment Method",
      "Amount (INR)",
      "Notes",
    ];

    const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const lines = [
      headers.join(","),
      ...metrics.monthTxs.map((tx) =>
        [
          escapeCsv(tx.id),
          escapeCsv(tx.date),
          escapeCsv(tx.name),
          escapeCsv(tx.category),
          escapeCsv(tx.type),
          escapeCsv(tx.paymentMethod),
          tx.amount.toFixed(2),
          escapeCsv(tx.notes || ""),
        ].join(",")
      ),
    ];

    triggerFileDownload(
      lines.join("\n"),
      `RupeeLedger_${appState.activeMonth}.csv`,
      "text/csv;charset=utf-8;"
    );
    showAlert("CSV report downloaded.");
  }

  function exportJsonBackup() {
    const payload = JSON.stringify(appState, null, 2);
    triggerFileDownload(
      payload,
      `RupeeLedger_Backup_${getTodayDateStr()}.json`,
      "application/json"
    );
    showAlert("JSON backup exported.");
  }

  function handleJsonImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.transactions)) {
          throw new Error("Invalid backup schema.");
        }

        const validTxs = parsed.transactions.filter(isValidTransactionRecord);
        const validBudgets =
          parsed.budgets && typeof parsed.budgets === "object" ? parsed.budgets : {};

        appState = {
          activeMonth: /^\d{4}-\d{2}$/.test(parsed.activeMonth)
            ? parsed.activeMonth
            : getCurrentMonthStr(),
          budgets: validBudgets,
          transactions: validTxs,
        };

        ensureBudgetExists(appState.activeMonth);
        document.getElementById("activeMonthFilter").value = appState.activeMonth;
        document.getElementById("filterMonth").value = appState.activeMonth;

        saveState();
        renderAll();
        showAlert(`Backup restored (${validTxs.length} transactions loaded).`);
      } catch (err) {
        showAlert("Failed to import JSON: Invalid or corrupted backup file.", "error");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function triggerFileDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function confirmClearAllData() {
    openConfirmModal(
      "Erase All Local Data",
      "This will permanently delete all budgets and transactions stored in your browser. Export a JSON backup first if needed.",
      () => {
        localStorage.removeItem(STORAGE_KEY);
        appState = {
          activeMonth: getCurrentMonthStr(),
          budgets: {},
          transactions: [],
        };
        ensureBudgetExists(appState.activeMonth);
        saveState();
        renderAll();
        showAlert("All application data has been cleared.");
      }
    );
  }

  // --- Initialization & Event Binding ---

  function init() {
    loadState();

    const today = getTodayDateStr();
    document.getElementById("txDate").value = today;
    document.getElementById("savDate").value = today;
    document.getElementById("activeMonthFilter").value = appState.activeMonth;
    document.getElementById("filterMonth").value = appState.activeMonth;

    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    document.getElementById("menuToggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });

    document.getElementById("quickAddBtn").addEventListener("click", () => {
      switchView("dashboard");
      document.getElementById("txName").focus();
    });

    document.getElementById("activeMonthFilter").addEventListener("change", (e) => {
      if (/^\d{4}-\d{2}$/.test(e.target.value)) {
        appState.activeMonth = e.target.value;
        document.getElementById("filterMonth").value = appState.activeMonth;
        saveState();
        renderAll();
      }
    });

    document.getElementById("transactionForm").addEventListener("submit", handleTransactionSubmit);
    document.getElementById("txCancelEditBtn").addEventListener("click", resetTransactionForm);
    document.getElementById("savingsTransferForm").addEventListener("submit", handleSavingsTransferSubmit);
    document.getElementById("budgetSetupForm").addEventListener("submit", handleBudgetSetupSubmit);

    ["searchInput", "filterCategory", "filterType", "filterMonth", "sortOrder"].forEach((id) => {
      document.getElementById(id).addEventListener("input", renderTransactionTable);
      document.getElementById(id).addEventListener("change", renderTransactionTable);
    });

    document.getElementById("resetFiltersBtn").addEventListener("click", () => {
      document.getElementById("searchInput").value = "";
      document.getElementById("filterCategory").value = "ALL";
      document.getElementById("filterType").value = "ALL";
      document.getElementById("filterMonth").value = "";
      document.getElementById("sortOrder").value = "date_desc";
      renderTransactionTable();
    });

    document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);
    document.getElementById("exportJsonBtn").addEventListener("click", exportJsonBackup);
    document.getElementById("importJsonInput").addEventListener("change", handleJsonImport);
    document.getElementById("clearAllDataBtn").addEventListener("click", confirmClearAllData);

    document.getElementById("modalCancelBtn").addEventListener("click", closeConfirmModal);
    document.getElementById("modalConfirmBtn").addEventListener("click", () => {
      if (typeof pendingConfirmCallback === "function") {
        pendingConfirmCallback();
      }
      closeConfirmModal();
    });

    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
