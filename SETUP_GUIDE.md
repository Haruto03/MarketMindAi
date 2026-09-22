# 🚀 MarketMind AI - Setup & Testing Guide

Welcome to the **MarketMind AI** simulator! This application uses the Google Gemini API to recruit and simulate 10 highly realistic virtual consumer personas to run focus group interviews on your product ideas, marketing copy, or custom questions.

Follow this step-by-step guide to get the application up and running on your local machine.

---

## 🛠️ Prerequisites (Install Node.js)

First, you need to install **Node.js** to run the local server environment.

1. Go to the [Node.js Official Website (https://nodejs.org/)](https://nodejs.org/).
2. Download the installer labeled **"LTS (Recommended For Most Users)"**.
3. Double-click the downloaded file (e.g., `node-vxx.xx.x-x64.msi`) and follow the installation wizard. You can keep all settings at their default values.

---

## 🔑 Step 1: Get a Free Gemini API Key

This application uses Google's latest AI model to power the simulation. You can get a developer API key for free.

1. Go to [Google AI Studio (https://aistudio.google.com/)](https://aistudio.google.com/app/apikey).
2. Log in using your standard Google Account.
3. Click the **"Create API key"** button.
4. Copy the long generated key (a string starting with `AIza...`) and save it somewhere secure (like a notepad).

---

## 📂 Step 2: Get & Configure the Project Files

1. **Extract the ZIP File**
   * Extract (unzip) `MarketMind-AI.zip` to a location of your choice (e.g., your Desktop).
   * Open the extracted `MarketMind-AI` folder.

2. **Create your `.env` Config File**
   * In the main directory, find the file named **`.env.example`**.
   * Copy and paste it in the same directory to create a duplicate.
   * Rename this new duplicate file to **`.env`**.
     *(Note: If file extensions are hidden on your system, make sure the file name is exactly `env` with a dot prefix like `.env`)*
   * Open `.env` with a text editor (like Notepad) and replace the placeholder text with your actual Gemini API key:

```text
# Replace the placeholder text with your actual API key
VITE_GEMINI_API_KEY=your_actual_api_key_here
GEMINI_API_KEY=your_actual_api_key_here
```

---

## 💻 Step 3: Run the Application via Terminal / Command Prompt

1. **Open your terminal inside the project folder**
   * **Windows**: Hold the `Shift` key and right-click on any empty space inside the `MarketMindAi` folder, then select **"Open PowerShell window here"** or **"Open in Terminal"**.
     *(If that doesn't appear, open the Start menu, search for "cmd", open Command Prompt, and navigate to your folder using `cd C:\path\to\MarketMind-AI`)*
   * **macOS / Linux**: Open Terminal, type `cd `, drag-and-drop the extracted folder into the terminal window, and press `Enter`.

2. **Install Dependencies**
   Run the following command in the terminal to download the necessary code packages (takes about 20–30 seconds):
   ```bash
   npm install
   ```

3. **Start the Development Server**
   Once the installation is complete, start the server by running:
   ```bash
   npm run dev
   ```

---

## 🌐 Step 4: Access and Test the Simulator

Once the server has started successfully, you will see a message in your terminal:

```text
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
```

1. Open your web browser (Google Chrome, Microsoft Edge, Safari, etc.).
2. Go to **`http://localhost:3000`** in the address bar.
3. You will be greeted by the dark slate-themed **MarketMind AI** interface!
4. **Try a Simulation**:
   * Enter a target market, income cohort, habits, and a custom product question in the form on Tab 1.
   * Click **"Start Simulation"**.
   * Go to Tab 2 to watch the 10 virtual consumers get generated and see the strategic executive report stream in in real-time!
   * Go to Tab 3 to conduct a **1-on-1 text-based chat interview** with any of the 10 generated personas to drill down into their feedback.

---

### 🛑 How to Stop the Server
When you are done testing, go back to the terminal window, press **`Ctrl + C`**, type **`y`**, and press **`Enter`** to safely shut down the development server.
