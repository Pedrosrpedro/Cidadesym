// menu.js - VERSÃO FINAL SIMPLIFICADA

const Menu = {
    // A função init agora só prepara os botões, mas não inicia o jogo.
    // O 'main.js' vai decidir quando chamar Game.init() e UI.init().
    init: function() {
        const newGameBtn = document.getElementById('new-game-btn');
        const optionsBtn = document.getElementById('options-btn');
        const sairBtn = document.getElementById('exit-btn');
        
        if (!newGameBtn) {
            console.error("Menu.init: Botão 'Novo Jogo' não encontrado.");
            return;
        }

        // Ação do botão "Novo Jogo" para esconder o menu
        newGameBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('game-container').classList.remove('hidden');
            document.getElementById('bottom-bar').classList.remove('hidden');
            // A linha Game.init() foi REMOVIDA daqui de propósito.
        });

        // Configura os outros botões do menu
        optionsBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.error(err));
            } else {
                document.exitFullscreen();
            }
        });

        sairBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Tem certeza de que deseja sair?')) alert('Obrigado por jogar!');
        });
    }
};
