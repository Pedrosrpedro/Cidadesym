// menu.js

const Menu = {
    init: function() {
        const addUniversalListener = (element, callback) => {
            if (!element) return;
            const action = (e) => { e.preventDefault(); callback(e); };
            element.addEventListener('click', action);
            element.addEventListener('touchstart', (e) => action(e), { passive: false });
        };
        
        const newGameBtn = document.getElementById('new-game-btn');
        const optionsBtn = document.getElementById('options-btn');
        const sairBtn = document.getElementById('exit-btn');
        
        if (!newGameBtn || !optionsBtn || !sairBtn) {
            console.error("Menu.init: Um ou mais botões do menu não foram encontrados!");
            return;
        }

        addUniversalListener(newGameBtn, () => {
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('game-container').classList.remove('hidden');
            document.getElementById('bottom-bar').classList.remove('hidden');
            Game.init();
        });

        addUniversalListener(optionsBtn, () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.error(err));
            } else {
                document.exitFullscreen();
            }
        });

        addUniversalListener(sairBtn, () => {
            if (confirm('Tem certeza de que deseja sair?')) alert('Obrigado por jogar!');
        });
    }
};
