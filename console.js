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
        closeButton.addEventListener('click', () => this.toggle(false)); // NOVO
        clearBtn.addEventListener('click', () => this.clear());
        
        this.log("Console de Debug inicializado.");
    },

    // Agora o toggle pode forçar o console a abrir ou fechar
    toggle: function(forceShow) {
        if (!this.consoleElement) return;
        
        if (typeof forceShow === 'boolean') {
            this.consoleElement.classList.toggle('hidden', !forceShow);
        } else {
            this.consoleElement.classList.toggle('hidden');
        }
    },
    
    log: function(message) { /* ...código sem alterações... */ },
    error: function(message) { /* ...código sem alterações... */ },
    clear: function() { /* ...código sem alterações... */ }
};
