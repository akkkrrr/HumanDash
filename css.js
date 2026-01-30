:root {
    --bg-color: #f4f7f6;
    --card-bg: #ffffff;
    --primary: #2563eb;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
    --radius: 12px;
    --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-main);
    line-height: 1.5;
    padding: 1rem;
}

.container {
    max-width: 600px;
    margin: 0 auto;
}

header { margin-bottom: 2rem; }
.subtitle { color: var(--text-muted); font-size: 0.9rem; }

.card {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    margin-bottom: 2rem;
}

h2 { margin-bottom: 1.2rem; font-size: 1.25rem; }

.form-group { margin-bottom: 1rem; display: flex; flex-direction: column; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

label { font-weight: 600; font-size: 0.85rem; margin-bottom: 0.4rem; }

input[type="text"], input[type="number"] {
    padding: 0.8rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 1rem;
}

.checkbox-group { flex-direction: row; align-items: center; gap: 0.5rem; }

button {
    width: 100%;
    padding: 1rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s;
}

button:active { opacity: 0.8; }

/* Lista-asettelu */
.log-item {
    background: var(--card-bg);
    padding: 1rem;
    border-radius: var(--radius);
    margin-bottom: 0.75rem;
    border-left: 4px solid var(--primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.log-info h4 { font-size: 1rem; text-transform: capitalize; }
.log-details { font-size: 0.85rem; color: var(--text-muted); }
.log-volume { font-weight: 800; color: var(--primary); text-align: right; }
.failure-tag { color: #dc2626; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; }