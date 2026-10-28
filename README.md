# TechAssist AI – Full-Stack Support & Complaint Management

Backend: Node.js + Express (REST API, JSON file database, token auth, rule-based AI engine)
Frontend: index.html + styles.css + app.js (same folder)

## Run in VS Code
1. Install Node.js (https://nodejs.org, version 18+)
2. Open this folder in VS Code (File > Open Folder)
3. Terminal (Ctrl+`):  npm install   then   npm start
4. Open http://localhost:3000

## Demo logins
user@demo.com / user123   |   agent@demo.com / agent123   |   admin@demo.com / admin123

## Structure
server.js      API routes, auth, tickets, stats, users
ai.js          AI analysis + chatbot (swap for a real LLM API)
data/db.json   created on first run (delete it to reset data)
index.html     page shell
styles.css     design
app.js         frontend logic (calls the API)
