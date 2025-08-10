document.addEventListener('DOMContentLoaded', () => {
    DebugConsole.log("script.js: DOM carregado. Configurando listeners do menu.");

    // Função auxiliar para toque e clique
    const addUniversalListener = (element, callback) => {
        if (!element) return;
        let fired = false;
        const action = (e) => {
            e.preventDefault();
            if (!fired) {
                fired = true;
                callback(e);
                setTimeout(() => { fired = false; }, 300);
            }
        };
        element.addEventListener('click', action);
        element.addEventListener('touchstart', (e) => action(e), { passive: false });
    };

    // Pegando os elementos da UI
    const mainMenu = document.getElementById('main-menu');
    const gameContainer = document.getElementById('game-container');
    const newGameBtn = document.getElementById('new-game-btn');
    const optionsBtn = document.getElementById('options-btn');
    const exitGameBtn = document.getElementById('exit-game-btn');
    const otherButtons = document.querySelectorAll('.menu-button:not(#new-game-btn):not(#options-btn)');

    // Verificando se os elementos existem
    if (!mainMenu) DebugConsole.error("Elemento 'main-menu' não encontrado!");
    if (!gameContainer) DebugConsole.error("Elemento 'game-container' não encontrado!");
    if (!newGameBtn) DebugConsole.error("Botão 'new-game-btn' não encontrado!");
    if (!optionsBtn) DebugConsole.error("Botão 'options-btn' não encontrado!");
    if (!exitGameBtn) DebugConsole.error("Botão 'exit-game-btn' não encontrado!");
    
    // Iniciar Jogo
    addUniversalListener(newGameBtn, () => {
        DebugConsole.log("Botão 'Novo Jogo' pressionado.");
        try {
            mainMenu.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            DebugConsole.log("Iniciando Game.init()...");
            Game.init();
            DebugConsole.log("Game.init() concluído.");
        } catch (err) {
            DebugConsole.error("ERRO ao iniciar o jogo: " + err.message + " | " + err.stack);
        }
    });

    // Voltar ao Menu
    addUniversalListener(exitGameBtn, () => {
        DebugConsole.log("Botão 'Voltar ao Menu' pressionado. Recarregando a página.");
        window.location.reload();
    });

    // Opções (Tela Cheia)
    addUniversalListener(optionsBtn, () => {
        DebugConsole.log("Botão 'Opções' pressionado.");
        const elem = document.documentElement;
        if (!document.fullscreenElement) {
            DebugConsole.log("Entrando em tela cheia.");
            elem.requestFullscreen().catch(err => {
                DebugConsole.error(`Erro ao entrar em tela cheia: ${err.message}`);
            });
        } else {
            DebugConsole.log("Saindo da tela cheia.");
            document.exitFullscreen();
        }
    });

    // Outros botões
    otherButtons.forEach(button => {
        addUniversalListener(button, () => {
            const action = button.textContent;
            DebugConsole.log(`Botão '${action}' pressionado.`);
            if (action === 'Sair') {
                if (confirm('Tem certeza de que deseja sair?')) {
                    alert('Obrigado por jogar CidadeSym!');
                }
            } else {
                alert(`A funcionalidade "${action}" ainda não foi implementada.`);
            }
        });
    });

    DebugConsole.log("script.js: Todos os listeners do menu foram configurados.");
});
