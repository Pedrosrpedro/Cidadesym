document.addEventListener('DOMContentLoaded', () => {
    // Pegando os elementos principais da UI
    const mainMenu = document.getElementById('main-menu');
    const gameContainer = document.getElementById('game-container');
    const newGameBtn = document.getElementById('new-game-btn');
    const exitGameBtn = document.getElementById('exit-game-btn');

    // --- FUNÇÃO AUXILIAR PARA TOQUE E CLIQUE ---
    // Adiciona um listener que funciona tanto no desktop (click) quanto no mobile (touchstart)
    const addUniversalListener = (element, callback) => {
        let fired = false;
        const action = (e) => {
            if (!fired) {
                fired = true;
                callback(e);
                // Reseta o 'fired' depois de um pequeno delay para permitir novos cliques/toques
                setTimeout(() => { fired = false; }, 500);
            }
        };
        element.addEventListener('click', action);
        element.addEventListener('touchstart', action);
    };

    // --- Lógica para iniciar o jogo (usando a nova função) ---
    addUniversalListener(newGameBtn, (event) => {
        event.preventDefault();
        console.log('Iniciando novo jogo...');
        
        mainMenu.classList.add('hidden');
        gameContainer.classList.remove('hidden');

        // Inicializa a cena 3D
        Game.init();
    });

    // --- Lógica para voltar ao menu ---
    addUniversalListener(exitGameBtn, () => {
        window.location.reload();
    });

    // Lógica para os outros botões
    const otherButtons = document.querySelectorAll('.menu-button:not(#new-game-btn)');
    otherButtons.forEach(button => {
        addUniversalListener(button, (event) => {
            event.preventDefault();
            const action = event.target.textContent;
            if (action === 'Sair') {
                if (confirm('Tem certeza de que deseja sair?')) {
                    alert('Obrigado por jogar CidadeSym!');
                }
            } else {
                alert(`A funcionalidade "${action}" ainda não foi implementada.`);
            }
        });
    });
});
