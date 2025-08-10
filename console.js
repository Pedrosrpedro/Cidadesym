// console.js (Completo e Corrigido)

const DebugConsole = {
    consoleElement: null,
    logContainer: null,

    // A função init agora é a única função que precisa ser chamada de fora.
    // Ela configura tudo o que o console precisa para funcionar.
    init: function() {
        // Passo 1: Capturar erros globais.
        // Isso é crucial e deve ser a primeira coisa que o console faz.
        window.onerror = (message, source, lineno) => {
            // Tenta extrair apenas o nome do arquivo da URL completa.
            const fileName = source ? source.split('/').pop() : 'script';
            const errorMsg = `ERRO: "${message}" em ${fileName} (linha:${lineno})`;
            this.error(errorMsg);
            
            // Força a abertura do console se um erro ocorrer.
            this.toggle(true); 
            
            // Retornar true impede que o erro apareça no console do navegador.
            return true;
        };
        
        // Passo 2: Conectar-se aos elementos do HTML.
        this.consoleElement = document.getElementById('debug-console-container');
        this.logContainer = document.getElementById('debug-log');
        const toggleButton = document.getElementById('debug-toggle-btn');
        const closeButton = document.getElementById('debug-close-btn');
        const clearBtn = document.getElementById('debug-clear-btn');

        // Verificação de segurança: se os botões não existirem, avisa no console do navegador.
        if (!this.consoleElement || !toggleButton || !closeButton || !clearBtn) {
            console.error("DebugConsole: Falha ao encontrar um ou mais elementos da UI do console no HTML. O console na tela não funcionará.");
            return;
        }

        // Passo 3: Adicionar funcionalidade aos botões.
        toggleButton.addEventListener('click', () => this.toggle());
        closeButton.addEventListener('click', () => this.toggle(false)); // Força o fechamento
        clearBtn.addEventListener('click', () => this.clear());
        
        // Loga uma mensagem para confirmar que foi inicializado com sucesso.
        this.log("Console de Debug inicializado e pronto.");
    },

    /**
     * Mostra ou esconde a janela do console.
     * @param {boolean} [forceShow] - Se true, força a exibição. Se false, força o fechamento. Se indefinido, alterna.
     */
    toggle: function(forceShow) {
        if (!this.consoleElement) return;
        
        if (typeof forceShow === 'boolean') {
            // Força um estado específico (visível ou escondido)
            this.consoleElement.classList.toggle('hidden', !forceShow);
        } else {
            // Alterna o estado atual
            this.consoleElement.classList.toggle('hidden');
        }
    },
    
    /**
     * Adiciona uma mensagem de log normal (branca) ao console.
     * @param {string} message - A mensagem a ser exibida.
     */
    log: function(message) {
        if (!this.logContainer) return;
        const entry = document.createElement('p');
        entry.className = 'log-entry log-info';
        // Usamos textContent para segurança, para evitar injeção de HTML.
        entry.textContent = `[INFO] ${message}`; 
        this.logContainer.appendChild(entry);
        // Rola automaticamente para a mensagem mais recente.
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    },

    /**
     * Adiciona uma mensagem de erro (vermelha) ao console.
     * @param {string} message - A mensagem de erro a ser exibida.
     */
    error: function(message) {
        if (!this.logContainer) return;
        const entry = document.createElement('p');
        entry.className = 'log-entry log-error';
        entry.textContent = `[ERRO] ${message}`;
        this.logContainer.appendChild(entry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    },

    /**
     * Limpa todas as mensagens da janela do console.
     */
    clear: function() {
        if (!this.logContainer) return;
        this.logContainer.innerHTML = '';
        this.log('Console limpo.');
    }
};
