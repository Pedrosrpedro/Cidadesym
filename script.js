document.addEventListener('DOMContentLoaded', () => {
    // Pegando os elementos principais da UI
    const mainMenu = document.getElementById('main-menu');
    const gameContainer = document.getElementById('game-container');
    const newGameBtn = document.getElementById('new-game-btn');
    const exitGameBtn = document.getElementById('exit-game-btn');

    // --- Lógica para iniciar o jogo ---
    newGameBtn.addEventListener('click', (event) => {
        event.preventDefault(); // Impede que o link faça a página rolar

        console.log('Iniciando novo jogo...');
        
        // Esconde o menu e mostra o container do jogo
        mainMenu.classList.add('hidden');
        gameContainer.classList.remove('hidden');

        // Inicializa a cena 3D (chama a função do nosso arquivo game.js)
        Game.init(); 
    });

    // --- Lógica para voltar ao menu ---
    exitGameBtn.addEventListener('click', () => {
        // Apenas recarrega a página. É a forma mais simples de "resetar" o estado.
        window.location.reload();
    });

    // Lógica para os outros botões (pode ser expandida no futuro)
    const otherButtons = document.querySelectorAll('.menu-button:not(#new-game-btn)');
    otherButtons.forEach(button => {
        button.addEventListener('click', (event) => {
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
