// ui.js
const UI = {
    activePanel: null,
    
    init: function() {
        // Botões que abrem painéis
        document.querySelectorAll('.main-tool-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.setActiveButton(button, true); // Botões principais sempre limpam os outros
                this.togglePanel(button.dataset.panel);
            });
        });

        // Botões dentro dos painéis
        document.querySelectorAll('.submenu-panel .ui-button').forEach(button => {
            button.addEventListener('click', () => {
                this.setActiveButton(button, false);
                Game.setBuildMode(button.dataset.buildMode);
            });
        });
        
        // Botões de ação direta
        const selectBtn = document.getElementById('btn-select');
        if(selectBtn) selectBtn.addEventListener('click', () => {
            this.setActiveButton(selectBtn, true);
            this.closeAllPanels();
            Game.setBuildMode('select');
        });

        const demolishBtn = document.getElementById('btn-demolish');
        if(demolishBtn) demolishBtn.addEventListener('click', () => {
            this.setActiveButton(demolishBtn, true);
            this.closeAllPanels();
            Game.setBuildMode('demolish');
        });
        
        // Botões do HUD
        const exitGameBtn = document.getElementById('exit-game-btn');
        if (exitGameBtn) exitGameBtn.addEventListener('click', () => window.location.reload());
        
        const powerOverlayBtn = document.getElementById('power-overlay-btn');
        if (powerOverlayBtn) powerOverlayBtn.addEventListener('click', () => {
            powerOverlayBtn.classList.toggle('active');
            Game.togglePowerOverlay();
        });

        this.setActiveButton(selectBtn, true);
    },
    
    togglePanel: function(panelId) {
        const newPanel = document.getElementById(panelId);
        if (!newPanel) return;
        if (this.activePanel === newPanel) {
            this.closeAllPanels();
            return;
        }
        this.closeAllPanels();
        newPanel.classList.remove('hidden');
        this.activePanel = newPanel;
    },

    closeAllPanels: function() {
        document.querySelectorAll('.submenu-panel').forEach(p => p.classList.add('hidden'));
    },
    
    setActiveButton: function(clickedButton, isMainToolbar) {
        // Limpa todos os botões ativos
        document.querySelectorAll('.ui-button.active').forEach(btn => btn.classList.remove('active'));
        
        if (clickedButton) {
            clickedButton.classList.add('active');
            // Se o botão for da barra principal, ele mesmo fica ativo
            // Se for do sub-menu, o pai dele (categoria) também fica ativo
            if (!isMainToolbar) {
                const parentPanelId = clickedButton.parentElement.id;
                document.querySelector(`.main-tool-btn[data-panel="${parentPanelId}"]`).classList.add('active');
            }
        }
    },
    
    // NOVO: Atualiza a barra de informações de energia
    updatePowerInfo: function(available, needed) {
        const powerInfoElement = document.getElementById('power-info');
        if (powerInfoElement) {
            powerInfoElement.textContent = `ENERGIA: ${available.toFixed(0)} / ${needed.toFixed(1)} MW`;
            if (available < needed) {
                powerInfoElement.classList.add('shortage');
            } else {
                powerInfoElement.classList.remove('shortage');
            }
        }
    }
};
