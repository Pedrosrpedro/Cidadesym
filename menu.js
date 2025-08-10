// menu.js

const Menu = {
    init: function() {
        DebugConsole.log("Menu.init: Configurando listeners dos botões.");
        
        const addUniversalListener = (element, callback) => {
            if (!element) return;
            const action = (e) => { e.preventDefault(); callback(e); };
            element.addEventListener('click', action);
            element.addEventListener('touchstart', (e) => action(e), { passive: false });
        };
        
        const newGameBtn = document.getElementById('new-game-btn');
        const optionsBtn = document.getElementById('options-btn');
        const exitGameBtn = document.getElementById('exit-game-btn');
        const sairBtn = document.getElementById('exit-btn');
        
        if (!newGameBtn || !optionsBtn || !exitGameBtn || !sairBtn) {
            DebugConsole.error("Menu.init: Um ou mais botões não foram encontrados no HTML!");
            return;
        }

        addUniversalListener(newGameBtn, () => {
            DebugConsole.log("Botão 'Novo Jogo' pressionado.");
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('game-container').classList.remove('hidden');
            Game.init();
        });

        addUniversalListener(exitGameBtn, () => window.location.reload());

        addUniversalListener(optionsBtn, () => {
            DebugConsole.log("Botão 'Opções' (Tela Cheia) pressionado.");
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => DebugConsole.error(`Tela cheia falhou: ${err.message}`));
            } else {
                document.exitFullscreen();
            }
        });

        addUniversalListener(sairBtn, () => {
            if (confirm('Tem certeza de que deseja sair?')) alert('Obrigado por jogar CidadeSym!');
        });
        
        DebugConsole.log("Menu.init: Configuração do menu concluída.");
    }
};
