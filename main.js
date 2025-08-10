// main.js

// Este é o ÚNICO ponto de entrada da nossa aplicação.
// Ele espera o HTML estar 100% pronto antes de executar qualquer coisa.
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializa o console de debug. Ele precisa ser o primeiro
    //    para capturar erros de outras partes do sistema.
    DebugConsole.init();
    
    // 2. Inicializa a lógica do menu principal.
    Menu.init();
    
    // O Game.init() só será chamado quando o usuário clicar em "Novo Jogo".
});
