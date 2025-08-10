// console.js
const DebugConsole = {
    logContainer: null,
    
    init: function() {
        // Captura todos os erros da página
        window.onerror = (message, source, lineno) => {
            const fileName = source ? source.split('/').pop() : 'script';
            this.error(`ERRO: "${message}" em ${fileName} (linha:${lineno})`);
            this.show();
            return true;
        };
        
        // Conecta aos elementos do HTML
        this.logContainer = document.getElementById('debug-log');
        const toggleButton = document.getElementById('debug-toggle-btn');
        if (toggleButton) toggleButton.addEventListener('click', () => this.toggle());
        
        console.log("Console de Debug pronto.");
    },

    show: function() {
        const consoleEl = document.getElementById('debug-console-container');
        if (consoleEl) consoleEl.classList.remove('hidden');
    },

    toggle: function() {
        const consoleEl = document.getElementById('debug-console-container');
        if (consoleEl) consoleEl.classList.toggle('hidden');
    },
    
    log: function(message) {
        if (!this.logContainer) return;
        const entry = document.createElement('p');
        entry.className = 'log-entry log-info';
        entry.textContent = `[INFO] ${message}`;
        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    },

    error: function(message) {
        if (!this.logContainer) return;
        const entry = document.createElement('p');
        entry.className = 'log-entry log-error';
        entry.textContent = `[ERRO] ${message}`;
        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }
};
