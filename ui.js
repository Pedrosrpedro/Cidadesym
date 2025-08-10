// ui.js

const UI = {
    activePanel: null,
    
    init: function() {
        // Lógica para os botões da barra principal abrirem seus painéis
        document.querySelectorAll('.main-tool-btn').forEach(button => {
            button.addEventListener('click', () => {
                const panelId = button.dataset.panel;
                this.togglePanel(panelId);
            });
        });

        // Lógica para os botões de construção nos sub-painéis
        document.querySelectorAll('.submenu-panel .ui-button').forEach(button => {
            button.addEventListener('click', () => {
                const buildMode = button.dataset.buildMode;
                Game.setBuildMode(buildMode);
                // Fecha todos os painéis após selecionar uma ferramenta
                this.closeAllPanels();
            });
        });
        
        // Botão de demolir é um caso especial
        const demolishBtn = document.getElementById('btn-demolish');
        if(demolishBtn) {
            demolishBtn.addEventListener('click', () => {
                this.closeAllPanels();
                Game.setBuildMode('demolish');
            });
        }
        
        // Botão para sair do jogo e voltar ao menu
        const exitGameBtn = document.getElementById('exit-game-btn');
        if (exitGameBtn) exitGameBtn.addEventListener('click', () => window.location.reload());
    },
    
    togglePanel: function(panelId) {
        const newPanel = document.getElementById(panelId);
        if (!newPanel) return;

        // Se o painel clicado já está ativo, fecha ele
        if (this.activePanel === newPanel) {
            this.activePanel.classList.add('hidden');
            this.activePanel = null;
            return;
        }

        // Fecha qualquer outro painel que esteja aberto
        this.closeAllPanels();

        // Abre o novo painel
        newPanel.classList.remove('hidden');
        this.activePanel = newPanel;
    },

    closeAllPanels: function() {
        document.querySelectorAll('.submenu-panel').forEach(p => p.classList.add('hidden'));
        this.activePanel = null;
    }
};
