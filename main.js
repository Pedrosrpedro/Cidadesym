// main.js - VERSÃO FINAL COM TELA DE CARREGAMENTO

window.addEventListener('DOMContentLoaded', () => {
    
    // 1. Inicializa sistemas que não dependem do jogo, como o console.
    DebugConsole.init();

    // 2. Pega os elementos da DOM que vamos manipular.
    const mainMenu = document.getElementById('main-menu');
    const gameContainer = document.getElementById('game-container');
    const bottomBar = document.getElementById('bottom-bar');
    const loadingScreen = document.getElementById('loading-screen'); // Nossa nova tela
    const newGameBtn = document.getElementById('new-game-btn');
    const optionsBtn = document.getElementById('options-btn');
    const sairBtn = document.getElementById('exit-btn');

    if (!newGameBtn || !loadingScreen) {
        DebugConsole.error("CRÍTICO: Elementos essenciais (Novo Jogo ou Tela de Carregamento) não encontrados.");
        return;
    }

    DebugConsole.log("Sistema pronto. Clique em 'Novo Jogo' para começar.");

    // 3. Adiciona o listener para o botão "Novo Jogo"
    newGameBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Esconde o menu e mostra a interface do jogo e A TELA DE CARREGAMENTO
        mainMenu.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        bottomBar.classList.remove('hidden');
        loadingScreen.classList.remove('hidden');

        // --- O TRUQUE PARA O CARREGAMENTO FUNCIONAR ---
        // Usamos um setTimeout para dar ao navegador um momento para renderizar
        // a tela de carregamento ANTES de começar o trabalho pesado de Game.init().
        setTimeout(() => {
            try {
                // Dentro do setTimeout, agora fazemos o trabalho pesado:
                Game.init(); // Carrega o terreno, cria a cena, etc.
                UI.init();   // Prepara todos os botões da UI do jogo.
                
                // Depois que tudo foi carregado e inicializado com sucesso...
                DebugConsole.log("Cidade carregada. Bem-vindo!");

            } catch (error) {
                // Se algo der errado durante a inicialização, mostramos no console.
                DebugConsole.error(`Falha crítica durante a inicialização: ${error.message}`);
            } finally {
                // ...escondemos a tela de carregamento, revelando o jogo.
                loadingScreen.classList.add('hidden');
            }
        }, 100); // Um pequeno delay de 100ms é suficiente.
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

});
