const Menu = {
    init: function() {
        DebugConsole.log("Menu.init: Configurando listeners do menu.");
        
        // Função auxiliar para toque e clique
        const addUniversalListener = (element, callback) => {
            if (!element) return;
            const action = (e) => {
                e.preventDefault();
                callback(e);
            };
            element.addEventListener('click', action);
            element.addEventListener('touchstart', (e) => action(e), { passive: false });
        };

        // Pegando os elementos
        const newGameBtn = document.getElementById('new-game-btn');
        const optionsBtn = document.getElementById('options-btn');
        const exitGameBtn = document.getElementById('exit-game-btn');
        const sairBtn = Array.from(document.querySelectorAll('.menu-button')).find(el => el.textContent === 'Sair');
        
        // Verificando
        if (!newGameBtn) DebugConsole.error("Botão 'new-game-btn' não encontrado!");
        if (!optionsBtn) DebugConsole.error("Botão 'options-btn' não encontrado!");
        if (!exitGameBtn) DebugConsole.error("Botão 'exit-game-btn' não encontrado!");
        if (!sairBtn) DebugConsole.error("Botão 'Sair' não encontrado!");

        // Iniciar Jogo
        addUniversalListener(newGameBtn, () => {
            DebugConsole.log("Botão 'Novo Jogo' pressionado.");
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('game-container').classList.remove('hidden');
            Game.init();
        });

        // Voltar ao Menu
        addUniversalListener(exitGameBtn, () => {
            DebugConsole.log("Botão 'Voltar ao Menu' pressionado.");
            window.location.reload();
        });

        // Opções (Tela Cheia)
        addUniversalListener(optionsBtn, () => {
            DebugConsole.log("Botão 'Opções' (Tela Cheia) pressionado.");
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => DebugConsole.error(`Tela cheia falhou: ${err.message}`));
            } else {
                document.exitFullscreen();
            }
        });

        // Sair
        addUniversalListener(sairBtn, () => {
            DebugConsole.log("Botão 'Sair' pressionado.");
            if (confirm('Tem certeza de que deseja sair?')) {
                alert('Obrigado por jogar CidadeSym!');
            }
        });
        
        DebugConsole.log("Menu.init: Configuração do menu concluída.");
    }
};
