const DebugConsole = {
    consoleElement: null,
    logContainer: null,
    
    init: function() {
        // Passo 1: Configurar a captura de erros imediatamente.
        window.onerror = (message, source, lineno, colno, error) => {
            const fileName = source ? source.split('/').pop() : 'script';
            const errorMsg = `ERRO: "${message}" em ${fileName} (linha:${lineno})`;
            this.error(errorMsg);
            this.toggle(true); // Força a abertura do console em caso de erro
            return true;
        };
        console.log("DebugConsole: Captura de erros global ativada.");
    },
    
    setupUI: function() {
        // Passo 2: Conectar-se aos elementos do HTML.
        this.consoleElement = document.getElementById('debug-console-container');
        this.logContainer = document.getElementById('debug-log');
        const toggleButton = document.getElementById('debug-toggle-btn');
        const clearBtn = document.getElementById('debug-clear-btn');

        if (!this.consoleElement || !toggleButton || !clearBtn) {
            console.error("DebugConsole: Falha ao encontrar elementos da UI do console no HTML.");
            return;
        }

        toggleButton.addEventListener('click', () => this.toggle());
        clearBtn.addEventListener('click', () => this.clear());
        
        this.log("UI do Console de Debug inicializada.");
    },

    toggle: function(forceShow = false) {
        if (!this.consoleElement) return;
        if (forceShow) {
            this.consoleElement.classList.remove('hidden');
        } else {
            this.consoleElement.classList.toggle('hidden');
        }
    },
    
    log: function(message) {
        if (!this.logContainer) return;
        const entry = document.createElement('p');
        entry.className = 'log-entry log-info';
        entry.innerHTML = `<span>[INFO]</span> ${message}`;
        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    },

    error: function(message) {
        if (!this.logContainer) return;
        const entry = document.createElement('p');
        entry.className = 'log-entry log-error';
        entry.innerHTML = `<span>[ERRO]</span> ${message}`;
        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    },

    clear: function() {
        if (!this.logContainer) return;
        this.logContainer.innerHTML = '';
        this.log('Console limpo.');
    }
};
