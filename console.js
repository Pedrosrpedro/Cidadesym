// console.js (Completo e Corrigido)

const DebugConsole = {
    consoleElement: null,
    logContainer: null,

    // Agora temos apenas uma função init, que faz tudo.
    init: function() {
        // Captura de erros globais (precisa ser a primeira coisa a rodar)
        window.onerror = (message, source, lineno) => {
            const fileName = source ? source.split('/').pop() : 'script';
            const errorMsg = `ERRO: "${message}" em ${fileName} (linha:${lineno})`;
            this.error(errorMsg);
            this.toggle(true); // Força a abertura do console
            return true;
        };
        
        // Conecta-se aos elementos do HTML
        this.consoleElement = document.getElementById('debug-console-container');
        this.logContainer = document.getElementById('debug-log');
        const toggleButton = document.getElementById('debug-toggle-btn');
        const closeButton = document.getElementById('debug-close-btn'); // NOVO
        const clearBtn = document.getElementById('debug-clear-btn');

        if (!this.consoleElement || !toggleButton || !closeButton || !clearBtn) {
            console.error("DebugConsole: Falha ao encontrar elementos da UI do console.");
            return;
        }

        // Adiciona funcionalidade aos botões
        toggleButton.addEventListener('click', () => this.toggle());
        closeButton.addEventListener('click', () => this.toggle(false)); // NOVO: Força o fechamento
        clearBtn.addEventListener('click', () => this.clear());
        
        this.log("Console de Debug inicializado e pronto para capturar erros.");
    },

    toggle: function(forceShow) {
        if (!this.consoleElement) return;
        if (typeof forceShow === 'boolean') {
            this.consoleElement.classList.toggle('hidden', !forceShow);
        } else {
            this.consoleElement.classList.toggle('hidden');
        }
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
    },

    clear: function() {
        if (!this.logContainer) return;
        this.logContainer.innerHTML = '';
        this.log('Console limpo.');
    }
};
