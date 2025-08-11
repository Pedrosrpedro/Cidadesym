// ui.js
const UI = {
    activePanel: null,
    
    init: function() {
        document.querySelectorAll('.main-tool-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.setActiveButton(button);
                this.togglePanel(button.dataset.panel);
            });
        });

        document.querySelectorAll('.submenu-panel .ui-button').forEach(button => {
            button.addEventListener('click', () => {
                this.setActiveButton(button);
                Game.setBuildMode(button.dataset.buildMode);
                this.closeAllPanels();
            });
        });
        
        const selectBtn = document.getElementById('btn-select');
        if(selectBtn) selectBtn.addEventListener('click', () => {
            this.setActiveButton(selectBtn);
            this.closeAllPanels();
            Game.setBuildMode('select');
        });

        const demolishBtn = document.getElementById('btn-demolish');
        if(demolishBtn) demolishBtn.addEventListener('click', () => {
            this.setActiveButton(demolishBtn);
            this.closeAllPanels();
            Game.setBuildMode('demolish');
        });
        
        const exitGameBtn = document.getElementById('exit-game-btn');
        if (exitGameBtn) exitGameBtn.addEventListener('click', () => window.location.reload());
        
        const powerOverlayBtn = document.getElementById('power-overlay-btn');
        if (powerOverlayBtn) powerOverlayBtn.addEventListener('click', () => {
            powerOverlayBtn.classList.toggle('active');
            Game.togglePowerOverlay();
        });

        this.setActiveButton(selectBtn);
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
        this.activePanel = null;
    },
    
    setActiveButton: function(clickedButton) {
        document.querySelectorAll('.ui-button.active').forEach(btn => btn.classList.remove('active'));
        if (clickedButton) clickedButton.classList.add('active');
    }
};
