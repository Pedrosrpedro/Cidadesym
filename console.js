// console.js

const DebugConsole = {
    consoleElement: null,
    logContainer: null,
    toggleButton: null,
    isVisible: false,

    // 1. Inicializa o console e captura os erros globais
    init: function() {
        // Pega os elementos do HTML
        this.toggleButton = document.getElementById('debug-toggle-btn');
        this.consoleElement = document.getElementById('debug-console-container');
        this.logContainer = document.getElementById('debug-log');
        const clearBtn = document.getElementById('debug-clear-btn');

        if (!this.toggleButton || !this.consoleElement) {
            console.error("Elementos do console de debug não encontrados no HTML!");
            return;
        }

        // Ação para o botão de mostrar/esconder
        this.toggleButton.addEventListener('click', () => this.toggle());
        this.toggleButton.addEventListener('touchstart', () => this.toggle());

        // Ação para o botão de limpar
        clearBtn.addEventListener('click', () => this.clear());
        
        // **A PARTE MAIS IMPORTANTE: Captura de Erros Globais**
        // Esta função será chamada automaticamente para qualquer erro não tratado no código
        window.onerror = (message, source, lineno, colno, error) => {
            const errorMsg = `ERRO: ${message} em ${source.split('/').pop()} (linha ${lineno})`;
            this.error(errorMsg);
            // Mostra o console automaticamente se ocorrer um erro
            if (!this.isVisible) {
                this.toggle();
            }
            return true; // Impede que o erro apareça no console padrão do navegador
        };
        
        this.log("Console de Debug inicializado.");
    },

    // 2. Mostra ou esconde o console
    toggle: function() {
        this.isVisible = !this.isVisible;
        this.consoleElement.classList.toggle('hidden', !this.isVisible);
    },
    
    // 3. Adiciona uma mensagem de log normal (branca)
    log: function(message) {
        const entry = document.createElement('p');
        entry.className = 'log-entry log-info';
        entry.innerHTML = `<span>[${new Date().toLocaleTimeString()}]</span> ${message}`;
        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight; // Rola para o final
    },

    // 4. Adiciona uma mensagem de erro (vermelha)
    error: function(message) {
        const entry = document.createElement('p');
        entry.className = 'log-entry log-error';
        entry.innerHTML = `<span>[${new Date().toLocaleTimeString()}]</span> ${message}`;
        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    },

    // 5. Limpa todas as mensagens
    clear: function() {
        this.logContainer.innerHTML = '';
    }
};

// Inicializa o console assim que o script for carregado
DebugConsole.init();
