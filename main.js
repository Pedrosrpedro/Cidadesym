// main.js - VERSÃO DE LIMPEZA E DIAGNÓSTICO

// A função só roda quando o HTML está pronto.
window.addEventListener('DOMContentLoaded', () => {
    
    // Mostra no console que este é o script correto que está rodando.
    console.log("======= EXECUTANDO main.js (versão de diagnóstico) =======");

    // 1. Inicializa o console de debug primeiro.
    DebugConsole.init();
    DebugConsole.log("main.js: DOM carregado. Console pronto.");

    // 2. Pega os elementos do menu.
    const newGameBtn = document.getElementById('new-game-btn');
    if (!newGameBtn) {
        DebugConsole.error("CRÍTICO: Botão 'Novo Jogo' não foi encontrado. Verifique o HTML.");
        return;
    }

    // 3. Adiciona o listener de clique para iniciar o jogo.
    newGameBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        DebugConsole.log("main.js: Botão 'Novo Jogo' clicado!");

        // Mostra a interface do jogo e a tela de carregamento.
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        document.getElementById('bottom-bar').classList.remove('hidden');
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.classList.remove('hidden');

        // Usa o setTimeout para garantir que a tela de carregamento apareça.
        setTimeout(() => {
            try {
                DebugConsole.log("main.js: INICIANDO O JOGO...");
                // ORDEM CRÍTICA: Primeiro o Game, depois a UI.
                Game.init();
                UI.init();
                DebugConsole.log("main.js: JOGO INICIADO COM SUCESSO!");

            } catch (error) {
                DebugConsole.error(`Falha crítica durante a inicialização: ${error.message}`);
            } finally {
                loadingScreen.classList.add('hidden');
            }
        }, 100);
    });

    // Configura os outros botões do menu.
    const optionsBtn = document.getElementById('options-btn');
    optionsBtn?.addEventListener('click', () => document.documentElement.requestFullscreen().catch(err => console.error(err)));

    const exitBtn = document.getElementById('exit-btn');
    exitBtn?.addEventListener('click', () => confirm('Tem certeza?') && alert('Obrigado por jogar!'));
});
