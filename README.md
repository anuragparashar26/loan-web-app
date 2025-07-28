# LendWise – Your Personal Loan Advisor!

LendWise is a multilingual loan advisor application that helps users explore, compare, and apply for loans with ease. It features an AI-powered chatbot for instant loan advice, interactive calculators, eligibility checks, and practical financial tips—all tailored for Indian users.

---

## 🚀 Features

- **AI Chatbot:** Get instant answers to your loan-related queries in multiple Indian languages.
- **Loan Calculators:** Calculate EMI, compare interest rates, and check CIBIL score information.
- **Eligibility Checker:** Instantly check your eligibility for home loans.
- **Loan Comparison:** Compare loan offers from different banks.
- **Financial Tips:** Access practical advice to improve your financial health.
- **Modern UI:** Responsive and user-friendly design.

---

## 🖥️ Demo

[Live on Render](https://loan-web-app-frontend-ew3f.onrender.com)  

---

## 🏗️ Project Structure

```
loan-web-app/
├── .gitignore
├── README.md
├── backend/
│   ├── loan_approval_dataset.csv
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
└── frontend/
    ├── assistant/
    │   ├── assistant.css
    │   ├── assistant.html
    │   └── assistant.js
    ├── chatbot.css
    ├── index.html
    ├── loanpage/
    │   ├── car.html
    │   ├── education.html
    │   ├── education2.html
    │   ├── home.html
    │   ├── home2.html
    │   └── personal.html
    ├── script.js
    ├── static/
    │   ├── logo.png
    │   └── tips.png
    ├── styles.css
    └── templates/
        ├── cibil.html
        ├── eligibility.html
        ├── emicalc.html
        └── loancomparison.html
```
---

## ⚡ Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/anuragparashar26/loan-web-app.git
cd loan-web-app
```

### 2. Backend Setup

- Go to the `backend` folder:
  ```bash
  cd backend
  ```
- Install dependencies:
  ```bash
  npm install
  ```
- Copy `.env.example` to `.env` and add your [Gemini API Key](https://aistudio.google.com/app/apikey):
  ```
  GEMINI_API_KEY=your_gemini_api_key
  ```
- Start the backend server:
  ```bash
  npm start
  ```

### 3. Frontend Setup

- Open `frontend/index.html` in your browser, or use a static server:
  ```bash
  cd ../frontend
  npx serve .
  ```
