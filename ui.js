// ui.js

const UI = {
    buttons: {},
    activeButton: null,

    init: function() {
        DebugConsole.log("UI.init: Configurando UI do jogo.");

        // Mapeia os botões para os modos de construção
        const buttonMappings = {
            'btn-select': 'select',
            'btn-road': 'road',
            'btn-residential': 'residential',
            'btn-commercial': 'commercial',
            'btn-demolish': 'demolish'
        };

        // Adiciona listeners para cada botão
        for (const [btnId, mode] of Object.entries(buttonMappings)) {
            const button = document.getElementById(btnId);
            if (button) {
                this.buttons[btnId] = button;
                button.addEventListener('click', () => {
                    this.setActiveButton(button);
                    Game.setBuildMode(mode);
                });
            } else {
                DebugConsole.error(`UI.init: Botão com ID '${btnId}' não foi encontrado.`);
            }
        }
        
        // Define o botão 'select' como ativo por padrão
        this.setActiveButton(this.buttons['btn-select']);
    },

    setActiveButton: function(clickedButton) {
        // Remove a classe 'active' de todos os botões
        for (const btnId in this.buttons) {
            this.buttons[btnId].classList.remove('active');
        }
        // Adiciona a classe 'active' apenas no botão clicado
        if (clickedButton) {
            clickedButton.classList.add('active');
            this.activeButton = clickedButton;
        }
    },
    
    showGameUI: function(shouldShow) {
        document.getElementById('bottom-bar').classList.toggle('hidden', !shouldShow);
    }
};
