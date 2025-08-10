// ui.js

const UI = {
    init: function() {
        const buttonMappings = {
            'btn-select': 'select', 'btn-road': 'road', 'btn-residential': 'residential',
            'btn-commercial': 'commercial', 'btn-demolish': 'demolish'
        };

        for (const [btnId, mode] of Object.entries(buttonMappings)) {
            const button = document.getElementById(btnId);
            if (button) {
                button.addEventListener('click', () => {
                    this.setActiveButton(button);
                    Game.setBuildMode(mode);
                });
            }
        }
        
        this.setActiveButton(document.getElementById('btn-select'));
        
        const exitGameBtn = document.getElementById('exit-game-btn');
        if (exitGameBtn) exitGameBtn.addEventListener('click', () => window.location.reload());
    },

    setActiveButton: function(clickedButton) {
        document.querySelectorAll('.ui-button.active').forEach(btn => btn.classList.remove('active'));
        if (clickedButton) clickedButton.classList.add('active');
    }
};
