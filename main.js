// main.js

// Este é o ÚNICO ponto de entrada da nossa aplicação.
// Ele espera o HTML estar 100% pronto antes de executar qualquer código.
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializa o console de debug. Ele precisa ser o primeiro
    //    para poder capturar erros de outras partes do sistema.
    DebugConsole.init();
    
    // 2. Inicializa a lógica e os botões do menu principal.
    Menu.init();
    
    // O Game.init() só será chamado quando o usuário clicar em "Novo Jogo" dentro do Menu.
});
