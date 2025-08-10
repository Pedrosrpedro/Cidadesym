document.addEventListener('DOMContentLoaded', () => {
    const mainMenu = document.getElementById('main-menu');
    const gameContainer = document.getElementById('game-container');
    const newGameBtn = document.getElementById('new-game-btn');
    const optionsBtn = document.getElementById('options-btn'); // Pega o botão de opções
    const exitGameBtn = document.getElementById('exit-game-btn');

    const addUniversalListener = (element, callback) => {
        // ... (código da função auxiliar igual ao anterior)
    };
    
    // Iniciar Jogo
    addUniversalListener(newGameBtn, (e) => {
        e.preventDefault();
        mainMenu.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        Game.init();
    });

    // Voltar ao Menu
    addUniversalListener(exitGameBtn, () => window.location.reload());

    // NOVO: Função de Tela Cheia
    addUniversalListener(optionsBtn, (e) => {
        e.preventDefault();
        const elem = document.documentElement;
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => {
                alert(`Erro ao tentar entrar em tela cheia: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });
    
    // Outros botões...
});
