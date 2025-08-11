// menu.js
const Menu = {
    init: function() {
        const newGameBtn = document.getElementById('new-game-btn');
        const optionsBtn = document.getElementById('options-btn');
        const sairBtn = document.getElementById('exit-btn');
        
        if (!newGameBtn || !optionsBtn || !sairBtn) {
            console.error("Menu.init: Botões do menu principal não encontrados.");
            return;
        }

        newGameBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('game-container').classList.remove('hidden');
            document.getElementById('bottom-bar').classList.remove('hidden');
            Game.init();
        });

        optionsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.error(err));
            } else {
                document.exitFullscreen();
            }
        });

        sairBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Tem certeza de que deseja sair?')) alert('Obrigado por jogar!');
        });
    }
};
