# 🚀 MarketMind AI - Setup & Testing Guide

Welcome to the **MarketMind AI** simulator! This application uses the Google Gemini API to recruit and simulate 10 highly realistic virtual consumer personas to run focus group interviews on your product ideas, marketing copy, or custom questions. Accounts and saved results are stored with Supabase.

Follow this step-by-step guide to get the application up and running on your local machine.

---

## 🛠️ Prerequisites (Install Node.js and Docker Desktop)

1. **Node.js** runs the application.
   * Go to the [Node.js Official Website (https://nodejs.org/)](https://nodejs.org/).
   * Download the installer labeled **"LTS (Recommended For Most Users)"**.
   * Double-click the downloaded file (e.g., `node-vxx.xx.x-x64.msi`) and follow the installation wizard. You can keep all settings at their default values.
2. **Docker Desktop** runs the database and login service on your computer.
   * Download it from [docker.com (https://www.docker.com/products/docker-desktop/)](https://www.docker.com/products/docker-desktop/) and install it with the default settings.
   * Open Docker Desktop and wait until it says it is running. It must stay open while you use MarketMind AI.

---

## 🔑 Step 1: Get a Free Gemini API Key

This application uses Google's latest AI model to power the simulation. You can get a developer API key for free.

1. Go to [Google AI Studio (https://aistudio.google.com/)](https://aistudio.google.com/app/apikey).
2. Log in using your standard Google Account.
3. Click the **"Create API key"** button.
4. Copy the long generated key (a string starting with `AIza...`) and save it somewhere secure (like a notepad).

---

## 📂 Step 2: Get the Project Files and Install

1. **Extract the ZIP File**
   * Extract (unzip) `MarketMind-AI.zip` to a location of your choice (e.g., your Desktop).
   * Open the extracted `MarketMind-AI` folder.

2. **Open your terminal inside the project folder**
   * **Windows**: Hold the `Shift` key and right-click on any empty space inside the `MarketMindAi` folder, then select **"Open PowerShell window here"** or **"Open in Terminal"**.
     *(If that doesn't appear, open the Start menu, search for "cmd", open Command Prompt, and navigate to your folder using `cd C:\path\to\MarketMind-AI`)*
   * **macOS / Linux**: Open Terminal, type `cd `, drag-and-drop the extracted folder into the terminal window, and press `Enter`.

3. **Install Dependencies**
   Run the following command to download the necessary code packages (takes about 20–30 seconds):
   ```bash
   npm install
   ```

---

## 🗄️ Step 3: Start the Local Database (Supabase)

With Docker Desktop running, start the database and login service:

```bash
npx supabase start
```

The first time, this downloads a few components and can take several minutes. When it finishes, run:

```bash
npx supabase status
```

Keep this output open — you need three values from it in the next step: the **API URL**, the **anon key** (sometimes labelled *publishable*) and the **service_role key** (sometimes labelled *secret*).

---

## ⚙️ Step 4: Create your `.env` Config File

* In the main directory, find the file named **`.env.example`**.
* Copy and paste it in the same directory to create a duplicate.
* Rename this new duplicate file to **`.env`**.
  *(Note: If file extensions are hidden on your system, make sure the file name is exactly `env` with a dot prefix like `.env`)*
* Open `.env` with a text editor (like Notepad) and fill in the values:

```text
GEMINI_API_KEY=your_gemini_key_from_step_1
VITE_SUPABASE_URL=the_API_URL_from_step_3
VITE_SUPABASE_ANON_KEY=the_anon_key_from_step_3
SUPABASE_SERVICE_ROLE_KEY=the_service_role_key_from_step_3
```

*(The Gemini key and the service_role key stay on your computer: only the local MarketMind server reads them — they are never sent to the browser. Never share the service_role key.)*

---

## 💻 Step 5: Run the Application

```bash
npm run dev
```

Once the server has started successfully, you will see a message in your terminal:

```text
MarketMind AI running at http://localhost:3000 (development)
```

---

## 🌐 Step 6: Access and Test the Simulator

1. Open your web browser (Google Chrome, Microsoft Edge, Safari, etc.).
2. Go to **`http://localhost:3000`** in the address bar.
3. Click **"Create account"** and sign up with any email and a password of at least 8 characters. (Locally, accounts are confirmed automatically — no email is actually sent.)
4. **Try a Simulation**:
   * Enter a target market, income cohort, habits, and a custom product question on Tab 1. Optionally add a Variant B or C to run an A/B test.
   * Click **"Simulate Focus Group"**.
   * Tab 2 shows the 10 virtual consumers, charts, and the strategic executive report streaming in real time.
   * Tab 3 lets you conduct a **1-on-1 text-based chat interview** with any of the 10 personas.
5. **Save, export and share** (buttons above the results):
   * **Save panel** keeps these 10 people so you can ask them a new question later (choose *Re-use a saved panel* on Tab 1).
   * **Export** downloads the results as PDF, Markdown or CSV.
   * **Share** creates a read-only link you can send to others (turn it off at any time).
6. Everything is saved to your account — reopen past simulations from **Saved Simulations**.

---

### 🛑 How to Stop

1. In the terminal running the app, press **`Ctrl + C`** (type **`y`** and press **`Enter`** if asked).
2. To stop the local database as well, run `npx supabase stop`. Your saved data is kept for next time.
