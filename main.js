// main.js
document.addEventListener('DOMContentLoaded', () => {
    // Console precisa ser o primeiro a iniciar
    DebugConsole.init();
    
    Menu.init();
    UI.init();
    
    console.log("CidadeSym v1.2.0 (debug) pronto.");
    DebugConsole.log("Sistema pronto. Clique em 'Novo Jogo' para iniciar.");
});
