# BigQuery Release Notes Hub & Tweet Composer

A premium, modern dashboard web application built with **Python Flask** and vanilla **HTML5, CSS3, and ES6 JavaScript**. The app parses Google Cloud's BigQuery release notes Atom feed, breaks down daily release logs into individual granular updates, and features an interactive Tweet Composer to tweet about specific updates.

---

## 🌟 Key Features

### 1. Granular Release Parsing
Standard RSS/Atom feeds bundle all updates for a single day into one large block. This application parses daily logs and splits them cleanly by `<h3>` tags (e.g. separating a "Feature" and a "Change" published on the same day). This allows you to select, read, and tweet about specific updates individually.

### 2. Intelligent Tweet Composer
* **Automatic Formatting**: Generates a pre-formatted draft based on the release type, date, description, and source link.
* **X/Twitter Character Counter**: Accurately handles Twitter's length rules by counting any URL as exactly 23 characters.
* **Progress Bar & Visual Warnings**: The composer progress bar changes color (green ➔ orange ➔ red) as you approach the character limit and disables the Tweet button if you exceed 280 characters.
* **Direct Integration**: The "Tweet this" button launches a pop-up window loading the draft directly into X's Web Intent composer.
* **Clipboard copy**: Quick-copy button to copy your drafted text with a single click.

### 3. API Cache Layer & Offline Resilience
* In-memory backend caching stores parsed release logs for 10 minutes to maximize load speeds and prevent API rate-limiting.
* A manual **Refresh** button with a loading spinner bypasses the cache to fetch live data directly.
* Features error fallback—if the internet connection drops or Google's feed is down, the server serves the stale cache with a toast warning instead of failing.

---

## 🛠️ Tech Stack

* **Backend**: Python 3.10+, Flask, requests, BeautifulSoup4 (HTML parsing), feedparser (Atom feed parsing)
* **Frontend**: HTML5 (Semantic elements), CSS3 (CSS Variables, Flexbox, CSS Grid, Glassmorphism design system), JavaScript (ES6, Fetch API, DOM event handlers)

---

## 📁 Project Structure

```
bq-releases-notes/
├── app.py                  # Flask server, Atom fetching, HTML splitting & API endpoints
├── .gitignore              # Files excluded from Git tracking
├── .gitattributes          # Excludes CSS/JS/HTML files from GitHub language statistics
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Semantic HTML dashboard structure
└── static/
    ├── css/
    │   └── style.css       # Obsidian glassmorphic stylesheet & CSS variables
    └── js/
        └── app.js          # Main client-side state controller & Tweet composer logic
```

---

## 🚀 Installation & Running Locally

### 1. Prerequisites
Ensure you have Python 3.10+ installed on your computer.

### 2. Setup Directory & Dependencies
Run the following commands in your command prompt/terminal:

```bash
# Navigate to the project directory
cd C:\Users\elotf\agy-cli-projects\bq-releases-notes

# Install required python packages
pip install flask requests feedparser beautifulsoup4
```

### 3. Run the Server
Start the Flask application:

```bash
python app.py
```

### 4. Open in Browser
Open your browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📝 GitHub Setup

The project has been initialized and pushed to GitHub. To push new updates:

```bash
git add .
git commit -m "Update message"
git push
```
Repository remote: `https://github.com/elotfian/elahehlotfian-event--talks-app-.git`
