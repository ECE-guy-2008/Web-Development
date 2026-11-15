<div align="center">

# ₹ RupeeLedger

### A private, offline-first personal expense and budget manager for the browser

Track income and expenses, set a monthly budget, ring-fence your savings, and see where your money goes, all with **zero dependencies, no backend and no sign-up**. Your data never leaves your device.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&logoColor=black)
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![Storage](https://img.shields.io/badge/storage-localStorage-6366f1)

<img src="docs/screenshots/dashboard.png" alt="RupeeLedger dashboard showing balance cards, budget progress, a category donut chart and a daily expense bar chart" width="900" />

</div>

---

## Table of contents

- [Why RupeeLedger?](#why-rupeeledger)
- [Features](#features)
- [Screenshots](#screenshots)
- [Getting started](#getting-started)
- [How to use it](#how-to-use-it)
- [How the numbers are calculated](#how-the-numbers-are-calculated)
- [Your data and privacy](#your-data-and-privacy)
- [Project structure](#project-structure)
- [Technical notes](#technical-notes)
- [Browser support](#browser-support)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [About this project](#about-this-project)
- [License](#license)

---

## Why RupeeLedger?

Most expense apps want an account, an internet connection, or access to your bank. RupeeLedger is the opposite: it is a single static web page that runs entirely in your browser. It was built with a student or early-career budget in mind (mess fees, metro recharges, freelance income, an emergency fund), and everything is shown in Indian Rupees (₹) with Indian number formatting.

The key idea is the **protected savings vault**. Money you move into savings is taken out of your spendable balance, so the number on the dashboard is what you can actually spend.

## Features

**Money tracking**

- Six transaction types: expense, income, balance addition, balance deduction, savings allocation and savings withdrawal
- Nine built-in categories: Food, College expenses, Transport, Shopping, Education, Entertainment, Emergency, Savings, Other
- Four payment methods: UPI, Cash, Card, Bank Transfer
- Add, edit and delete transactions; every balance recalculates instantly
- Optional notes on each entry (receipt reference, merchant, and so on)

**Budgeting**

- A separate **monthly budget** and **initial security allocation** for every month
- Live budget progress bar that turns amber at 80% and red at 100%
- Warning banners for an exceeded budget, a negative spendable balance, or usage of 85% and above

**Savings vault**

- Move money between *Available Balance* and *Protected Savings* in either direction
- Withdrawals are blocked if they exceed the protected savings balance
- A dedicated ledger of every savings transfer

**Insights**

- Four KPI cards: Available Balance, Total Income, Total Expenses, Protected Savings
- Category-wise spending donut chart with a legend showing amounts and percentages
- Daily expense bar chart for the whole month
- A plain-language monthly financial report
- Charts are drawn with the HTML5 Canvas API, so there is no charting library

**Data control**

- Search, filter (category, type, month) and sort (date or amount) the ledger
- **Export CSV** for the active month
- **Download a JSON backup** of everything, and **restore** it later
- **Reset everything** with a confirmation dialog

**Experience**

- Dark theme, responsive layout with a sidebar on desktop and a drawer menu on mobile
- Keyboard-friendly forms with validation and toast notifications

## Screenshots

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/transactions.png" alt="Transaction ledger with search, category, type, month and sort filters" />
      <p align="center"><b>Transaction ledger</b><br/>Search, filter, sort, edit and delete</p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/savings.png" alt="Savings and security vault with a transfer form and a savings ledger" />
      <p align="center"><b>Savings &amp; Security vault</b><br/>Move money in and out of protected savings</p>
    </td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/mobile.png" alt="RupeeLedger on a phone-sized screen" width="260" /><br/>
  <b>Responsive on mobile</b>
</p>

> The screenshots use fictional sample data.

## Getting started

RupeeLedger is plain HTML, CSS and JavaScript. There is **nothing to install and nothing to build**.

### Option 1: open the file

1. Download or clone the repository:

    ```bash
    git clone https://github.com/<your-username>/<your-repo-name>.git
    cd <your-repo-name>
    ```

2. Double-click `index.html`, or drag it into your browser.

### Option 2: run a tiny local server (optional)

Handy if you prefer to use `http://localhost`:

```bash
# Python 3
python -m http.server 8000

# or Node.js
npx serve .
```

Then open <http://localhost:8000>.

### Option 3: host it for free on GitHub Pages

1. Push the project to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and the `/ (root)` folder, then **Save**.
4. After a minute your app is live at `https://<your-username>.github.io/<your-repo-name>/`.

> Browser storage is tied to the address you open the app from. Data saved at `file:///...` is separate from data saved at `localhost` or on GitHub Pages. See [Your data and privacy](#your-data-and-privacy).

## How to use it

### 1. Set up your monthly budget

Open **Budget Setup** and enter:

| Field | Meaning |
| --- | --- |
| Budget month and year | The month this budget applies to |
| Monthly starting budget (₹) | The money you start the month with, and your spending cap |
| Initial security / savings allocation (₹) | Money already set aside as protected savings for that month |
| Description (optional) | A label such as "Semester 5 living budget" |

You can edit a budget at any time, and each month has its own.

### 2. Record transactions

Use **Quick Transaction Entry** on the dashboard (or the **+ New Entry** button). Each type affects your numbers differently:

| Type | Available balance | Protected savings | Counts as expense (budget bar and charts) |
| --- | :---: | :---: | :---: |
| **Expense** | − | n/a | Yes |
| **Income** | + | n/a | No |
| **Balance addition** (for example pocket money or a top-up) | + | n/a | No |
| **Balance deduction** (for example a loan repaid) | − | n/a | No |
| **Savings allocation** | − | + | No |
| **Savings withdrawal** | + | − | No |

### 3. Watch the dashboard

The banner, progress bar and charts update after every change. Use the month picker in the top bar to look at any other month.

### 4. Review, search and edit

The **Transactions** view lets you search by name or notes, filter by category, type or month, and sort by date or amount. Click **Edit** to load an entry back into the form, or **Delete** (with confirmation) to remove it.

### 5. Back up your data

Under **Reports & Data**:

- **Export CSV** downloads the active month's transactions (`RupeeLedger_YYYY-MM.csv`).
- **Download JSON** saves every budget and transaction (`RupeeLedger_Backup_YYYY-MM-DD.json`).
- **Choose File** restores a JSON backup. **This replaces the data currently in the app**, so export first if you want to keep it.

## How the numbers are calculated

Every figure is calculated **per calendar month** from that month's budget and that month's transactions:

```text
Available Balance = Starting Budget + Income + Balance Additions
                    − Expenses − Balance Deductions
                    − Savings Allocations + Savings Withdrawals

Protected Savings = Initial Security Allocation
                    + Savings Allocations − Savings Withdrawals

Total Funds       = Available Balance + Protected Savings
Remaining Budget  = Starting Budget − Expenses
Budget Used (%)   = Expenses ÷ Starting Budget × 100
Net Cash Flow     = Income − Expenses
```

All amounts are rounded to two decimal places at every step to avoid floating-point drift. Currency is formatted with `Intl.NumberFormat("en-IN")`, for example `₹1,23,456.00`.

**Worked example.** With a starting budget of ₹15,000, income of ₹6,500, a balance addition of ₹3,000, expenses of ₹11,338, and ₹1,500 moved into savings, the available balance is `15,000 + 6,500 + 3,000 − 11,338 − 1,500 = ₹11,662`.

## Your data and privacy

- **Everything stays on your device.** The app makes no network requests: there is no server, analytics, CDN or web font. You can use it offline.
- Data is saved in your browser's `localStorage` under the key `rupeeledger_finance_v1`.
- ⚠️ **It is not encrypted.** Anyone with access to your browser profile can read it. Use RupeeLedger only on a device you trust.
- Data is **per browser and per address**. A different browser, a private window, or a different URL (`file://` vs `localhost` vs GitHub Pages) starts empty.
- Clearing your browser's site data **erases your records**. Download a JSON backup regularly.
- This is a personal tracking tool, not financial, tax or accounting advice.

## Project structure

```text
.
├── index.html      # App markup: sidebar, five views, forms, confirmation modal
├── style.css       # Dark theme, layout, components, responsive breakpoints (1024px and 768px)
├── script.js       # State, calculations, rendering, charts, CRUD, import/export
├── docs/
│   └── screenshots/  # Images used in this README
└── README.md
```

## Technical notes

- **Vanilla stack.** HTML5, CSS3 and ES6+ JavaScript, with no framework, bundler or package manager.
- **Single source of truth.** One `appState` object (`activeMonth`, `budgets`, `transactions`) is saved to `localStorage` on every change, and the UI is re-rendered from it.
- **Safe rendering.** User text is inserted with `textContent` and DOM APIs, never `innerHTML`, so names and notes cannot inject markup.
- **Validation on load and import.** Each transaction is checked for a valid type, category, payment method, positive amount and `YYYY-MM-DD` date; invalid records are dropped. Unique IDs use `crypto.randomUUID()` with a fallback.
- **Canvas charts.** The donut and bar charts are drawn directly on `<canvas>` elements with no external library.
- **Accessibility touches.** Labelled form controls, `aria-live` notifications, `role="alert"` warnings, a `progressbar` role on the budget bar, and a modal dialog with `aria-modal`.

## Browser support

Tested in Chromium-based browsers (Chrome and Edge). The app uses only standard web APIs (`localStorage`, Canvas, `Intl`, `FileReader`), so current Firefox and Safari should work too. The month pickers use `<input type="month">`; in browsers that do not show a month picker it may appear as a plain text box, in which case type the month as `YYYY-MM`.

## Known limitations

- **No month-to-month rollover.** Each month is calculated on its own. Unspent money or savings do not carry into the next month automatically. Use a balance addition or the next month's budget and security allocation to carry them over by hand.
- **Single currency.** Amounts are in INR only.
- **No encryption or PIN lock.** See [Your data and privacy](#your-data-and-privacy).
- **No sync.** Data lives in one browser; move it between devices with the JSON backup.
- **Fixed categories and payment methods.** Changing them means editing `index.html` and the lists at the top of `script.js`.

## Roadmap

- [ ] Optional month-to-month balance rollover
- [ ] Recurring transactions (rent, subscriptions)
- [ ] Per-category budgets and alerts
- [ ] Custom categories
- [ ] CSV import
- [ ] Optional PIN or passphrase encryption for stored data
- [ ] Light theme and a theme toggle
- [ ] Installable PWA with a service worker
- [ ] Automated tests for the calculation engine

## Contributing

Suggestions and pull requests are welcome.

1. Fork the repository and create a branch: `git checkout -b feature/my-idea`
2. Make your change, and open `index.html` in a browser to test it
3. Commit with a clear message and open a pull request describing what changed and why

If you find a bug, please open an issue with the steps to reproduce it and your browser.

## About this project

This project was created with the help of an AI coding assistant. It is a learning and personal-use tool: review the code before relying on it for anything important, and keep regular backups of your data.

## License

Released under the [MIT License](LICENSE).
