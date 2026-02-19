# IBL Platform: Next-Generation Inquiry-Based Learning

![IBL Platform Banner](public/main.svg)

## 🚀 Overview

**IBL Platform** is a cutting-edge educational tool designed to revolutionize **Inquiry-Based Learning (IBL)** in STEM education. By integrating interactive simulations, digital worksheets, and AI-powered assistance, we bridge the gap between theoretical knowledge and practical application.

Traditional IBL faces significant challenges: high preparation time for teachers, lack of personalized student guidance, and difficulty in tracking real-time progress. Our platform addresses these pain points directly, offering a seamless ecosystem for educators and students alike.

## 🌟 Key Features & Solutions

### 1. 🔬 Interactive Simulations (The "Lab" Experience)
*   **Pain Point**: Physical labs are expensive, time-consuming, and limited by equipment.
*   **Solution**: We provide a library of pre-built simulations (Physics, Chemistry, Biology) and support **Custom React Simulations**. Teachers can write their own simulation code directly in the browser, offering unlimited flexibility.

### 2. 🤖 AI-Powered Content Generation
*   **Pain Point**: Creating high-quality, inquiry-driven questions takes hours.
*   **Solution**: Integrated with **Gemini** and **DeepSeek** AI models. Teachers can generate relevant worksheet questions (MCQ, Short Answer, etc.) with a single click based on the experiment title.

### 3. 🎓 AI Student Tutor (Context-Aware)
*   **Pain Point**: Students often get stuck during experiments, and teachers can't help everyone simultaneously.
*   **Solution**: A built-in **AI Chatbot** acts as a personal tutor. It uses **RAG (Retrieval-Augmented Generation)** based on teacher-provided course materials ("AI Context") to answer student questions accurately without giving away the answers directly.

### 4. 📊 Real-Time Analytics & Export
*   **Pain Point**: Grading paper worksheets is tedious and data analysis is manual.
*   **Solution**: 
    *   **Digital Worksheets**: Students submit answers online.
    *   **Dashboard**: Teachers view submissions in real-time.
    *   **CSV Export**: One-click export of all student data for gradebook integration.

### 5. 🌍 Accessibility & Inclusivity
*   **Pain Point**: Educational tools often lack language support or accessibility features.
*   **Solution**: 
    *   **Bilingual Interface**: One-click toggle between English and Traditional Chinese (繁體中文).
    *   **Dark Mode**: Fully supported for low-light environments.
    *   **Guest Preview**: Students can explore experiments without account creation barriers.

## 🛠 Tech Stack

*   **Framework**: Next.js 16 (App Router)
*   **Language**: TypeScript
*   **Database**: PostgreSQL (via Prisma ORM)
*   **Authentication**: NextAuth.js v5
*   **Styling**: Tailwind CSS + Shadcn/UI
*   **AI Integration**: Google Gemini API / DeepSeek API

## 🏁 Getting Started

### Prerequisites
*   Node.js 18+
*   PostgreSQL Database

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/A11MiND/IBL2.git
    cd IBL2
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file:
    ```env
    DATABASE_URL="postgresql://..."
    AUTH_SECRET="your-secret-key"
    ```

4.  **Initialize Database**
    ```bash
    npx prisma generate
    npx prisma db push
    ```

5.  **Run Development Server**
    ```bash
    npm run dev
    ```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## 📄 License

This project is licensed under the MIT License.

---

*Empowering the next generation of scientists through inquiry.*
